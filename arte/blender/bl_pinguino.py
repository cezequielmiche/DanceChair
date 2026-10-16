"""Disfraz de pingüino (pieza Disf_pinguino) para Chico/Chica: va encima de la ropa.
python bl_pinguino.py entrada.blend salida.blend salida.glb
* Capucha negra con la cara al descubierto (borde blanco), ojos y pico de pingüino arriba. Sigue a la cabeza.
* Cuerpo de huevo negro con panza blanca que tapa el torso (sigue a la columna y a la cadera).
* Aletas sobre los brazos (sigue a brazo y antebrazo), mallas negras en las piernas y patas naranjas.
* Bufanda del color elegido (tint_disfraz), con rayas en tono oscuro.
La app esconde el pelo, la ropa, los zapatos y los audífonos mientras se lleva puesto (las aletas tapan los brazos
y las manos, y el cuerpo tapa el torso)."""
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix

src, out_blend, out_glb = sys.argv[-3:]
bpy.ops.wm.open_mainfile(filepath=src)
scene = bpy.context.scene
arm = bpy.data.objects['Esqueleto']
old = bpy.data.objects.get('Disf_pinguino')
if old: bpy.data.objects.remove(old, do_unlink=True)

def new_mat(name, hex_, rough=0.55):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    h = hex_.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    m.diffuse_color = (*lin, 1); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    if bs: bs.inputs['Base Color'].default_value = (*lin, 1); bs.inputs['Roughness'].default_value = rough
    return m

B = {b.name: (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones}

# ---------------------------------------------------------------- medidas de este cuerpo
body = bpy.data.objects['Cuerpo']
hi = body.vertex_groups['Head'].index
hv = [body.matrix_world @ v.co for v in body.data.vertices if any(g.group == hi and g.weight > 0.9 for g in v.groups)]
mn = Vector((min(p.x for p in hv), min(p.y for p in hv), min(p.z for p in hv)))
mx = Vector((max(p.x for p in hv), max(p.y for p in hv), max(p.z for p in hv)))
hc = (mn + mx) / 2; hr = (mx - mn) / 2
def caja_mat(nombre):
    idx = [i for i, m in enumerate(body.data.materials) if m and m.name.split('.')[0] == nombre]
    ps = [body.matrix_world @ body.data.vertices[v].co for p in body.data.polygons if p.material_index in idx for v in p.vertices]
    return (min(p.x for p in ps), max(p.x for p in ps), min(p.z for p in ps), max(p.z for p in ps)) if ps else None
ojos = caja_mat('ojo_negro'); boca = caja_mat('boca'); rubor = caja_mat('rubor')
print('CABEZA', hc, hr, 'OJOS', ojos, 'BOCA', boca, 'RUBOR', rubor)

MATS = ['pin_negro', 'pin_blanco', 'pin_naranja', 'pin_ojo', 'tint_disfraz', 'tint_disfraz_osc']
COL = {'pin_negro': '#23262F', 'pin_blanco': '#F6F6F2', 'pin_naranja': '#FF9F1C', 'pin_ojo': '#121214',
       'tint_disfraz': '#3DBE4A', 'tint_disfraz_osc': '#1E5E28'}
MI = {n: i for i, n in enumerate(MATS)}
GROUPS = ['Head', 'Spine', 'Hips', 'LeftShoulder', 'RightShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand',
          'LeftUpLeg', 'LeftLeg', 'RightUpLeg', 'RightLeg', 'LeftFoot', 'RightFoot']
GI = {g: i for i, g in enumerate(GROUPS)}

bm = bmesh.new()
dl = bm.verts.layers.deform.verify()

def esfera(c, r, seg=28, anillos=16, rot=None):
    res = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=anillos, radius=1.0)
    M = Matrix.Diagonal((r[0], r[1], r[2]))
    if rot is not None: M = rot @ M
    for v in res['verts']: v.co = c + M @ v.co
    caras = list({f for v in res['verts'] for f in v.link_faces})
    for f in caras: f.smooth = True
    return res['verts'], caras

def pesos(verts, fn):
    """fn(posición) -> {grupo: peso}"""
    for v in verts:
        for g, w in fn(v.co).items():
            if w > 0: v[dl][GI[g]] = w

def mezcla(t, a, b, t0, t1):
    """peso de a → b según t entre t0 y t1"""
    k = min(1.0, max(0.0, (t - t0) / (t1 - t0)))
    return {a: 1 - k, b: k}

def parche(C, R, xz, nu, nv, mat, salida, grupos):
    """Superficie sobre el frente del elipsoide (C, R): xz(u, v) da (x, z) para u, v en [0, 1]. Bordes suaves
    (los cortes por cara dejaban escalones)."""
    filas = []
    for j in range(nv + 1):
        fila = []
        for i in range(nu + 1):
            x, z = xz(i / nu, j / nv)
            dx = (x - C.x) / R.x; dz = (z - C.z) / R.z
            r2 = dx * dx + dz * dz
            if r2 > 0.93:   # sin pasarse del contorno (si no, queda una lámina plana a los lados)
                k = math.sqrt(0.93 / r2); dx *= k; dz *= k; x = C.x + dx * R.x; z = C.z + dz * R.z
            y = C.y - R.y * math.sqrt(max(0.0, 1 - dx * dx - dz * dz))
            q = Vector((x, y, z))
            n = Vector(((q.x - C.x) / R.x ** 2, (q.y - C.y) / R.y ** 2, (q.z - C.z) / R.z ** 2)).normalized()
            fila.append(bm.verts.new(q + n * salida))
        filas.append(fila)
    caras = []
    for j in range(nv):
        for i in range(nu):
            f = bm.faces.new((filas[j][i], filas[j][i + 1], filas[j + 1][i + 1], filas[j + 1][i]))
            f.material_index = MI[mat]; f.smooth = True; caras.append(f)
    al_reves = [f for f in caras if (f.normal_update() or f.normal).dot(Vector((0, -1, 0))) < 0]
    if al_reves: bmesh.ops.reverse_faces(bm, faces=al_reves)
    pesos([v for fila in filas for v in fila], grupos)
    return caras

def material(caras, fn):
    for f in caras: f.material_index = MI[fn(f.calc_center_median())]

# ---------------------------------------------------------------- capucha
CR = Vector((hr.x * 1.075, hr.y * 1.11, hr.z * 1.24))
CC = hc + Vector((0, 0.005, -hr.z * 0.08))
# abertura de la cara: de las cejas a la barbilla y de cachete a cachete
ax = (rubor[1] if rubor else ojos[1]) * 1.32
az0 = (boca[2] if boca else hc.z - hr.z * 0.6) - 0.07
az1 = ojos[3] + 0.045
acz = (az0 + az1) / 2; arz = (az1 - az0) / 2
def en_abertura(c, k=1.0):
    return c.y < hc.y - hr.y * 0.15 and (c.x / (ax * k)) ** 2 + ((c.z - acz) / (arz * k)) ** 2 < 1
vs, caras = esfera(CC, CR, seg=64, anillos=36)
# abajo solo se abre por delante (la barbilla); por detrás la capucha cierra hasta la nuca
def bajo_barbilla(c): return c.z < hc.z - hr.z * 1.0 and c.y < hc.y + hr.y * 0.3
borrar = [f for f in caras if en_abertura(f.calc_center_median(), 0.97) or bajo_barbilla(f.calc_center_median())]
bmesh.ops.delete(bm, geom=borrar, context='FACES')
caras = [f for f in caras if f.is_valid]
vs = [v for v in vs if v.is_valid]
material(caras, lambda c: 'pin_negro')
pesos(vs, lambda p: {'Head': 1.0})
# antifaz blanco alrededor de la cara (como el pingüino de verdad): anillo suave que tapa el borde escalonado
def antifaz(u, v):
    t = 2 * math.pi * u
    k = 0.93 + v * ((1.3 - 0.16 * max(0.0, math.sin(t))) - 0.93)
    # sin bajar del borde de la capucha (si no, queda colgando bajo la barbilla)
    return ax * k * math.cos(t), max(hc.z - hr.z * 0.97, acz + arz * k * math.sin(t))
parche(CC, CR, antifaz, 80, 4, 'pin_blanco', 0.004, lambda p: {'Head': 1.0})
def sobre_capucha(x, z, salida):
    """Punto sobre la capucha (frente) en (x, z), despegado `salida`."""
    dz = (z - CC.z) / CR.z; dx = x / CR.x
    y = CC.y - CR.y * math.sqrt(max(0.0, 1 - dz * dz - dx * dx))
    p = Vector((x, y, z))
    n = Vector(((p.x - CC.x) / CR.x ** 2, (p.y - CC.y) / CR.y ** 2, (p.z - CC.z) / CR.z ** 2)).normalized()
    return p + n * salida, n

def disco(x, z, r, mat, salida, aplastar=0.35):
    p, n = sobre_capucha(x, z, salida)
    rot = n.to_track_quat('Z', 'Y').to_matrix()
    v, c = esfera(p, (r, r, r * aplastar), seg=20, anillos=10, rot=rot)
    material(c, lambda _: mat)
    pesos(v, lambda _: {'Head': 1.0})

# ojos de pingüino arriba de la cara
ez = az1 + (CC.z + CR.z - az1) * 0.38
for sx in (-1, 1):
    disco(sx * hr.x * 0.3, ez, hr.x * 0.15, 'pin_blanco', 0.0)
    disco(sx * hr.x * 0.28, ez - hr.x * 0.012, hr.x * 0.08, 'pin_ojo', hr.x * 0.035)
    disco(sx * hr.x * 0.255, ez + hr.x * 0.025, hr.x * 0.025, 'pin_blanco', hr.x * 0.06)
# pico naranja entre los ojos y la cara
pz = (ez + az1) / 2 - 0.005
p, n = sobre_capucha(0, pz, -0.01)
largo = hr.x * 0.24
res = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=hr.x * 0.11, radius2=0.002, depth=largo)
d = (n + Vector((0, 0, -0.35))).normalized()
rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
bmesh.ops.transform(bm, matrix=Matrix.Translation(p + d * largo * 0.5) @ rot @ Matrix.Diagonal((1, 0.6, 1, 1)), verts=res['verts'])
for f in {f for v in res['verts'] for f in v.link_faces}: f.material_index = MI['pin_naranja']; f.smooth = True
pesos(res['verts'], lambda _: {'Head': 1.0})

# ---------------------------------------------------------------- cuerpo de huevo con panza blanca
hip = B['Hips'][0].z; spine0 = B['Spine'][0].z; cuello = B['Spine'][1].z
HC = Vector((0, 0.005, (hip + cuello) / 2 + 0.01))
HR = Vector((0.226, 0.2, (cuello - hip) / 2 + 0.125))
vs, caras = esfera(HC, HR, seg=44, anillos=26)
material(caras, lambda c: 'pin_negro')
pesos(vs, lambda p: mezcla(p.z, 'Hips', 'Spine', hip + 0.03, spine0 + 0.05))
# panza blanca (óvalo suave sobre el frente)
def panza(u, v):
    t = 2 * math.pi * u
    return 0.15 * v * math.cos(t), HC.z - 0.03 + HR.z * 0.78 * v * math.sin(t)
parche(HC, HR, panza, 48, 6, 'pin_blanco', 0.003, lambda p: mezcla(p.z, 'Hips', 'Spine', hip + 0.03, spine0 + 0.05))

# bufanda: aro sobre los hombros y una punta colgando al frente
bz = cuello + 0.005
R = Vector((HR.x * math.sqrt(max(0.0, 1 - ((bz - HC.z) / HR.z) ** 2)), HR.y * math.sqrt(max(0.0, 1 - ((bz - HC.z) / HR.z) ** 2)), 0))
filas = []
N, S = 36, 10
for i in range(N):
    a = 2 * math.pi * i / N
    d = Vector((math.cos(a), math.sin(a), 0))
    centro = Vector((HC.x + d.x * (R.x + 0.012), HC.y + d.y * (R.y + 0.012), bz))
    fila = []
    for j in range(S):
        b = 2 * math.pi * j / S
        fila.append(bm.verts.new(centro + d * 0.038 * math.cos(b) + Vector((0, 0, 0.036 * math.sin(b)))))
    filas.append(fila)
bufanda = []
for i in range(N):
    A, Bf = filas[i], filas[(i + 1) % N]
    for j in range(S):
        f = bm.faces.new((A[j], Bf[j], Bf[(j + 1) % S], A[(j + 1) % S])); f.smooth = True
        f.material_index = MI['tint_disfraz_osc'] if i % 6 in (0, 1) else MI['tint_disfraz']
        bufanda.append(f)
pesos([v for fila in filas for v in fila], lambda p: {'Spine': 1.0})
# punta colgando (un poco a la derecha del pecho)
px = 0.07
p0 = Vector((px, HC.y - R.y - 0.02, bz - 0.01))
v, c = esfera(p0 + Vector((0, -0.01, -0.07)), (0.03, 0.016, 0.08), seg=14, anillos=10, rot=Matrix.Rotation(math.radians(-12), 3, 'Y'))
material(c, lambda q: 'tint_disfraz_osc' if abs(q.z - (bz - 0.12)) < 0.012 or abs(q.z - (bz - 0.09)) < 0.008 else 'tint_disfraz')
pesos(v, lambda _: {'Spine': 1.0})
bmesh.ops.recalc_face_normals(bm, faces=bufanda)

# ---------------------------------------------------------------- aletas
for lado in ('Left', 'Right'):
    a0 = B[lado + 'Arm'][0]; codo = B[lado + 'ForeArm'][0]; muneca = B[lado + 'Hand'][0]
    eje = (muneca - a0); L = eje.length; d = eje.normalized()
    # aleta: del hombro hasta tapar la mano (como el ala de un pingüino) y más gruesa que cualquier manga
    centro = a0 + d * (L * 0.76)
    rot = d.to_track_quat('Z', 'Y').to_matrix()
    v, c = esfera(centro, (0.1, 0.086, L * 0.88), seg=28, anillos=18, rot=rot)
    material(c, lambda _: 'pin_negro')
    tcodo = (codo - a0).dot(d) / L
    def ala(p, lado=lado, a0=a0, d=d, L=L, tc=tcodo):
        t = (p - a0).dot(d) / L
        if t < 0.98: return mezcla(t, lado + 'Arm', lado + 'ForeArm', tc - 0.12, tc + 0.12)
        return mezcla(t, lado + 'ForeArm', lado + 'Hand', 0.98, 1.12)
    pesos(v, ala)
    # hombro: tapa el inicio de la manga que queda fuera del cuerpo
    v, c = esfera(a0 + Vector((0, 0, 0.012)), (0.1, 0.095, 0.09), seg=20, anillos=12)
    material(c, lambda _: 'pin_negro'); pesos(v, lambda _, g=lado + 'Arm': {g: 1.0})
    # punta del ala sobre la mano (los dedos se asomaban por dentro)
    gm = body.vertex_groups[lado + 'Hand'].index
    hp = [body.matrix_world @ q.co for q in body.data.vertices if any(g.group == gm and g.weight > 0.3 for g in q.groups)]
    lo = Vector((min(q.x for q in hp), min(q.y for q in hp), min(q.z for q in hp)))
    hi_ = Vector((max(q.x for q in hp), max(q.y for q in hp), max(q.z for q in hp)))
    v, c = esfera((lo + hi_) / 2, ((hi_.x - lo.x) / 2 * 1.5 + 0.012, (hi_.y - lo.y) / 2 * 1.3 + 0.01, (hi_.z - lo.z) / 2 * 1.2 + 0.01), seg=18, anillos=12)
    material(c, lambda _: 'pin_negro'); pesos(v, lambda _, g=lado + 'Hand': {g: 1.0})
    # clavícula: entre el cuello y el hombro (al subir los brazos se asomaba la ropa)
    h0, h1 = B[lado + 'Shoulder']
    v, c = esfera((h0 + h1) / 2 + Vector((0, 0, 0.01)), (0.085, 0.09, 0.065), seg=20, anillos=12)
    material(c, lambda _: 'pin_negro'); pesos(v, lambda _, g=lado + 'Shoulder': {g: 1.0})

# ---------------------------------------------------------------- mallas negras y patas
for lado in ('Left', 'Right'):
    cad, rod = B[lado + 'UpLeg']; tob = B[lado + 'Leg'][1]
    for (p0, p1, g0, g1, r0, r1) in ((cad + Vector((0, 0, -0.02)), rod + Vector((0, 0, -0.03)), lado + 'UpLeg', lado + 'Leg', 0.07, 0.064),
                                     (rod + Vector((0, 0, 0.03)), tob + Vector((0, 0, -0.02)), lado + 'Leg', lado + 'Leg', 0.064, 0.056)):
        eje = p1 - p0; L = eje.length; d = eje.normalized()
        rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        res = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=r0, radius2=r1, depth=L)
        bmesh.ops.transform(bm, matrix=Matrix.Translation((p0 + p1) / 2) @ rot, verts=res['verts'])
        for f in {f for v in res['verts'] for f in v.link_faces}: f.material_index = MI['pin_negro']; f.smooth = True
        pesos(res['verts'], lambda p, p0=p0, d=d, L=L, g0=g0, g1=g1: mezcla((p - p0).dot(d) / L, g0, g1, 0.7, 1.0) if g0 != g1 else {g0: 1.0})
    # pata naranja: ancha y plana, con tres dedos redondos
    tal = B[lado + 'Foot'][0]; pun = B[lado + 'Foot'][1]
    c0 = Vector((tal.x, (tal.y + pun.y) / 2 - 0.03, 0.03))
    v, c = esfera(c0, (0.075, 0.1, 0.032), seg=20, anillos=10)
    material(c, lambda _: 'pin_naranja'); pesos(v, lambda _, g=lado + 'Foot': {g: 1.0})
    for k in (-1, 0, 1):
        v, c = esfera(c0 + Vector((k * 0.04, -0.085 - (0.012 if k == 0 else 0), -0.004)), (0.026, 0.035, 0.024), seg=12, anillos=8)
        material(c, lambda _: 'pin_naranja'); pesos(v, lambda _, g=lado + 'Foot': {g: 1.0})

# ---------------------------------------------------------------- objeto
me = bpy.data.meshes.new('Disf_pinguino')
bm.to_mesh(me); bm.free()
o = bpy.data.objects.new('Disf_pinguino', me)
scene.collection.objects.link(o)
for n in MATS: me.materials.append(new_mat(n, COL[n], 0.35 if n == 'pin_ojo' else 0.6))
for g in GROUPS: o.vertex_groups.new(name=g)
o.parent = arm
mod = o.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
print('PINGUINO verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons))

bpy.ops.wm.save_as_mainfile(filepath=out_blend, compress=True)
pieces = [x for x in bpy.data.objects if x.type == 'MESH']
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
for x in pieces: x.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_yup=True,
                          export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
                          export_cameras=False, export_lights=False, export_apply=False)
print('EXPORT OK', out_glb, sorted(x.name for x in pieces))
