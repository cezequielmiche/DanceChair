"""Disfraz inflable de dinosaurio "montado" (pieza Disf_dino) para Chico/Chica.
python bl_dino.py entrada.blend salida.blend salida.glb
El niño queda dentro del dino de la cintura para abajo: las patas del dino siguen a sus piernas,
el cuerpo y la cabeza del dino siguen a la cadera, y dos piernitas falsas cuelgan a los lados."""
import bpy, bmesh, sys, os, math
from mathutils import Vector, Matrix
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

src, out_blend, out_glb = sys.argv[-3:]
bpy.ops.wm.open_mainfile(filepath=src)
scene = bpy.context.scene
arm = bpy.data.objects['Esqueleto']
old = bpy.data.objects.get('Disf_dino')
if old: bpy.data.objects.remove(old, do_unlink=True)

def new_mat(name, hex_, rough=0.55):
    m = bpy.data.materials.get(name)
    if m: return m   # ya existe (tint_pantalon del jean): se reutiliza tal cual
    m = bpy.data.materials.new(name)
    h = hex_.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    m.diffuse_color = (*lin, 1); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    if bs: bs.inputs['Base Color'].default_value = (*lin, 1); bs.inputs['Roughness'].default_value = rough
    return m

B = {b.name: (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local) for b in arm.data.bones}
hipZ = B['Hips'][0].z            # ~0.39
legX = abs(B['LeftUpLeg'][0].x)  # ~0.08
kneeZ = B['LeftLeg'][0].z
k = hipZ / 0.394                 # todo está pensado para el chico; se ajusta si la chica mide distinto
print('HIP', hipZ, 'LEGX', legX, 'K', k)

MATS = ['tint_disfraz', 'tint_disfraz_osc', 'dino_panza', 'dino_blanco', 'dino_boca', 'dino_ojo_rojo', 'dino_negro', 'tint_pantalon', 'dino_bota']
COL = {'tint_disfraz': '#3DBE4A', 'tint_disfraz_osc': '#1E5E28', 'dino_panza': '#FFD93D', 'dino_blanco': '#FFFFFF',
       'dino_boca': '#F28BA8', 'dino_ojo_rojo': '#C8202F', 'dino_negro': '#151515', 'tint_pantalon': '#6B6B4A', 'dino_bota': '#7A4A2A'}
MI = {n: i for i, n in enumerate(MATS)}

bm = bmesh.new()
dl = bm.verts.layers.deform.verify()
GROUPS = ['Hips', 'LeftUpLeg', 'RightUpLeg', 'LeftLeg', 'RightLeg', 'LeftFoot', 'RightFoot']
GI = {g: i for i, g in enumerate(GROUPS)}
parts = []   # (verts, faces, material, group)

def V(x, y, z): return Vector((x * k, y * k, z * k))

def blob(c, r, mat, group, rot=None, seg=18, rings=11, stripes=None):
    """Elipsoide inflado. c centro, r radios (x,y,z). rot: matriz 3x3 opcional."""
    res = bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    vs = res['verts']
    M = Matrix.Diagonal((r[0] * k, r[1] * k, r[2] * k))
    if rot is not None: M = rot @ M
    for v in vs:
        v.co = c + M @ v.co
        v[dl][GI[group]] = 1.0
    faces = {f for v in vs for f in v.link_faces}
    for f in faces:
        f.material_index = MI[mat]; f.smooth = True
        if stripes:
            p = f.calc_center_median()
            if stripes(p): f.material_index = MI['tint_disfraz_osc']
    return vs

def cone(base, tip, rad, mat, group, seg=10):
    d = tip - base; L = d.length
    res = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=rad * k, radius2=0.002, depth=L)
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    T = Matrix.Translation((base + tip) / 2) @ q.to_matrix().to_4x4()
    bmesh.ops.transform(bm, matrix=T, verts=res['verts'])
    for v in res['verts']: v[dl][GI[group]] = 1.0
    for f in {f for v in res['verts'] for f in v.link_faces}:
        f.material_index = MI[mat]; f.smooth = True

def rotX(deg): return Matrix.Rotation(math.radians(deg), 3, 'X')
def rotY(deg): return Matrix.Rotation(math.radians(deg), 3, 'Y')
def rotZ(deg): return Matrix.Rotation(math.radians(deg), 3, 'Z')

# franjas oscuras en el lomo y la cola (bandas a lo largo del eje Y, solo en la parte de arriba/lados)
def stripe_body(p):
    if p.z < V(0, 0, 0.36).z: return False
    t = (p.y / k) * 14.0
    return (t - math.floor(t)) < 0.22 and abs(p.x) > 0.05 * k
def stripe_tail(p):
    t = (p.y / k) * 12.0
    return (t - math.floor(t)) < 0.25

# --- cuerpo (envuelve la cadera del niño) ---
blob(V(0, 0.03, 0.37), (0.235, 0.29, 0.215), 'tint_disfraz', 'Hips', stripes=stripe_body)
# panza amarilla al frente
blob(V(0, -0.15, 0.34), (0.165, 0.13, 0.19), 'dino_panza', 'Hips', rot=rotX(-12))
# cuello y cabeza al frente, a la altura del pecho del niño
blob(V(0, -0.24, 0.50), (0.125, 0.12, 0.17), 'tint_disfraz', 'Hips', rot=rotX(-25))
blob(V(0, -0.2, 0.47), (0.10, 0.09, 0.14), 'dino_panza', 'Hips', rot=rotX(-25))
blob(V(0, -0.38, 0.66), (0.145, 0.19, 0.125), 'tint_disfraz', 'Hips', rot=rotX(8))
# mandíbula de abajo y boca rosa abierta
blob(V(0, -0.44, 0.565), (0.115, 0.15, 0.045), 'tint_disfraz', 'Hips', rot=rotX(-8))
blob(V(0, -0.45, 0.6), (0.11, 0.15, 0.035), 'dino_boca', 'Hips', rot=rotX(-2))
# dientes arriba y abajo
for i in range(7):
    a = math.radians(-70 + i * (140 / 6))
    x = math.sin(a) * 0.1; y = -0.45 - math.cos(a) * 0.13
    cone(V(x, y, 0.625), V(x, y, 0.595), 0.012, 'dino_blanco', 'Hips', seg=6)
    cone(V(x * 0.95, y * 0.99, 0.585), V(x * 0.95, y * 0.99, 0.61), 0.011, 'dino_blanco', 'Hips', seg=6)
# ojos saltones con iris rojo
for sx in (1, -1):
    c = V(sx * 0.105, -0.40, 0.745)
    blob(c, (0.055, 0.055, 0.055), 'dino_blanco', 'Hips', seg=16, rings=10)
    blob(c + V(sx * 0.03, -0.035, 0.0), (0.03, 0.03, 0.03), 'dino_ojo_rojo', 'Hips', seg=12, rings=8)
    blob(c + V(sx * 0.045, -0.05, 0.0), (0.015, 0.015, 0.015), 'dino_negro', 'Hips', seg=10, rings=6)
    # fosas nasales
    blob(V(sx * 0.04, -0.555, 0.69), (0.012, 0.01, 0.01), 'dino_negro', 'Hips', seg=8, rings=6)
# bracitos con garras
for sx in (1, -1):
    blob(V(sx * 0.15, -0.25, 0.40), (0.05, 0.09, 0.05), 'tint_disfraz', 'Hips', rot=rotX(25) @ rotZ(sx * 20))
    for j in (-1, 0, 1):
        b = V(sx * (0.16 + j * 0.02), -0.33, 0.36)
        cone(b, b + V(0, -0.03, -0.03), 0.011, 'dino_blanco', 'Hips', seg=6)
# cola: bolas cada vez más chicas hacia atrás y abajo
for i in range(7):
    t = i / 6
    blob(V(0, 0.28 + t * 0.48, 0.34 - t * 0.24), (0.15 - t * 0.11, 0.12 - t * 0.06, 0.13 - t * 0.09), 'tint_disfraz', 'Hips',
         seg=14, rings=10, stripes=stripe_tail if i > 0 else None)
# crestas pequeñas en el lomo
for i in range(6):
    y = -0.14 + i * 0.1
    z = 0.565 - max(0, i - 2) * 0.035
    if abs(y) < 0.1: continue   # no donde va sentado el niño
    cone(V(0, y, z - 0.02), V(0, y + 0.02, z + 0.04), 0.03, 'tint_disfraz_osc', 'Hips', seg=8)

# --- patas: siguen a las piernas del niño ---
for side, sx in (('Left', 1), ('Right', -1)):
    x = sx * max(legX, 0.08) * 1.25
    blob(V(x / k * 1, 0.0, 0.27), (0.12, 0.15, 0.14), 'tint_disfraz', side + 'UpLeg', stripes=None)
    blob(V(x / k * 0.95, 0.0, 0.13), (0.085, 0.09, 0.1), 'tint_disfraz', side + 'Leg')
    blob(V(x / k * 0.95, -0.07, 0.045), (0.095, 0.15, 0.05), 'tint_disfraz', side + 'Foot')
    for j in (-1, 0, 1):
        b = V(x / k * 0.95 + j * 0.05, -0.2, 0.035)
        cone(b, b + V(j * 0.01, -0.05, -0.02), 0.018, 'dino_blanco', side + 'Foot', seg=8)

# --- piernitas falsas del "jinete" colgando a los lados ---
for sx in (1, -1):
    # muslo encima del lomo, saliendo hacia afuera
    blob(V(sx * 0.2, -0.07, 0.53), (0.09, 0.05, 0.05), 'tint_pantalon', 'Hips', rot=rotZ(0) @ rotY(sx * 28))
    # pantorrilla colgando
    blob(V(sx * 0.27, -0.1, 0.40), (0.045, 0.045, 0.1), 'tint_pantalon', 'Hips', rot=rotY(sx * 8))
    # bota café
    blob(V(sx * 0.28, -0.12, 0.29), (0.05, 0.06, 0.055), 'dino_bota', 'Hips')
    blob(V(sx * 0.28, -0.155, 0.27), (0.045, 0.06, 0.035), 'dino_bota', 'Hips')

# el dino (todo lo que va con la cadera) más grande: el niño es cabezón y se veía chiquito
G = 1.25; A = Vector((0, 0, 0.2 * k))
for v in bm.verts:
    if v[dl].get(GI['Hips'], 0) > 0.5:
        # cabeza un poco más baja para no tapar la cara del niño de frente
        t = min(1.0, max(0.0, (-v.co.y / k - 0.15) / 0.15)); v.co.z -= 0.06 * k * t
        v.co = A + (v.co - A) * G
me = bpy.data.meshes.new('Disf_dino')
bm.to_mesh(me); bm.free()
o = bpy.data.objects.new('Disf_dino', me)
scene.collection.objects.link(o)
for n in MATS: me.materials.append(new_mat(n, COL[n], 0.35 if n.startswith('tint_disfraz') or n == 'dino_panza' else 0.5))
# grupos de vértices con los pesos guardados en la capa deform
for g in GROUPS: o.vertex_groups.new(name=g)
o.parent = arm
mod = o.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
print('DINO verts', len(me.vertices), 'tris', sum(len(p.vertices) - 2 for p in me.polygons))

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
