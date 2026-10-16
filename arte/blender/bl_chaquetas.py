"""Sudadera con capucha y cara de oso (Camisa_sudadera) y chaqueta de mezclilla (Camisa_mezclilla) para Chico/Chica.
python bl_chaquetas.py entrada.blend salida.blend salida.glb
Las dos salen de Camisa_chaqueta (ya encaja en los dos cuerpos y tiene sus pesos): se copia, se cambian los
materiales y se le agregan detalles. Los detalles del frente (oso, bolsas, botones, costuras) se dibujan en 2D
y se proyectan sobre el pecho; toman los pesos del punto más cercano de la prenda."""
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree

src, out_blend, out_glb = sys.argv[-3:]
bpy.ops.wm.open_mainfile(filepath=src)
scene = bpy.context.scene
arm = bpy.data.objects['Esqueleto']
base = bpy.data.objects['Camisa_chaqueta']
for n in ('Camisa_sudadera', 'Camisa_mezclilla'):
    old = bpy.data.objects.get(n)
    if old: bpy.data.objects.remove(old, do_unlink=True)

def normal(f):
    f.normal_update(); return f.normal

def new_mat(name, hex_, rough=0.7):
    m = bpy.data.materials.get(name)
    if m: return m
    m = bpy.data.materials.new(name)
    h = hex_.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    m.diffuse_color = (*lin, 1); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    if bs: bs.inputs['Base Color'].default_value = (*lin, 1); bs.inputs['Roughness'].default_value = rough
    return m

# materiales de la chaqueta original (en la chica llevan ".001")
def mat_base(prefijo):
    return next(m for m in base.data.materials if m and m.name.split('.')[0] == prefijo)
TINT = mat_base('tint_camisa')
TINT_OSC = mat_base('tint_camisa_osc')

def copiar(nombre):
    me = base.data.copy(); me.name = nombre
    o = bpy.data.objects.new(nombre, me); scene.collection.objects.link(o)
    o.matrix_world = base.matrix_world.copy()
    for g in base.vertex_groups: o.vertex_groups.new(name=g.name)
    o.parent = arm
    mod = o.modifiers.new('Armature', 'ARMATURE'); mod.object = arm
    return o

def islas(bm, nombres):
    """Partes sueltas de la malla: (caras, materiales, z mínima)."""
    visto = set(); res = []
    for f in bm.faces:
        if f in visto: continue
        pila = [f]; isla = []; visto.add(f)
        while pila:
            g = pila.pop(); isla.append(g)
            for e in g.edges:
                for h in e.link_faces:
                    if h not in visto: visto.add(h); pila.append(h)
        res.append((isla, {nombres[g.material_index] for g in isla}, min(v.co.z for g in isla for v in g.verts)))
    return res

def quitar_islas(o, quitar):
    """Borra las partes sueltas de la malla para las que `quitar(materiales, zmin, caras)` es verdadero."""
    nombres = [m.name.split('.')[0] for m in o.data.materials]
    bm = bmesh.new(); bm.from_mesh(o.data)
    borrar = [f for isla, mats, zmin in islas(bm, nombres) if quitar(mats, zmin, len(isla)) for f in isla]
    bmesh.ops.delete(bm, geom=borrar, context='FACES')
    bm.to_mesh(o.data); bm.free()

def caras_de_islas(o, cuales):
    """Índices de las caras de las partes sueltas que cumplen `cuales(materiales, zmin, caras)`."""
    nombres = [m.name.split('.')[0] for m in o.data.materials]
    bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
    idx = {f.index for isla, mats, zmin in islas(bm, nombres) if cuales(mats, zmin, len(isla)) for f in isla}
    bm.free(); return idx

# piezas sueltas de la chaqueta original: el cierre (material negro) y las solapas del cuello (tela, arriba)
es_cierre = lambda mats, zmin, n: 'chico_ojo_negro' in mats
es_solapa = lambda mats, zmin, n: mats == {'tint_camisa'} and zmin > 0.6 and n < 200

def poner_mats(o, mats):
    """Deja en la prenda solo `mats` (lista) y devuelve {nombre: índice}. Las caras conservan su índice viejo
    (clear() los pone en 0) para poder reasignarlas según el material que tenían."""
    viejos = [p.material_index for p in o.data.polygons]
    o.data.materials.clear()
    for m in mats: o.data.materials.append(m)
    for p, i in zip(o.data.polygons, viejos): p.material_index = i
    return {m.name: i for i, m in enumerate(mats)}

# ---------------------------------------------------------------- proyección sobre el pecho
FRENTE = Vector((0, -1, 0))   # el personaje mira hacia -Y

class Calco:
    """Figuras 2D (x, z) proyectadas sobre el frente de la prenda, con un poco de despegue."""
    def __init__(self, prenda):
        self.fuente = prenda   # se proyecta sobre la prenda ya limpia y se copian sus pesos
        me = prenda.data
        pts = [prenda.matrix_world @ v.co for v in me.vertices]
        self.T = BVHTree.FromPolygons(pts, [tuple(p.vertices) for p in me.polygons])
        self.kd = KDTree(len(pts))
        for i, p in enumerate(pts): self.kd.insert(p, i)
        self.kd.balance()
        self.prenda = prenda
        self.bm = bmesh.new()
        self.dl = self.bm.verts.layers.deform.verify()

    def punto(self, x, z, despegue, lado=-1):
        hit = self.T.ray_cast(Vector((x, lado * 1.0, z)), Vector((0, -lado, 0)))
        if hit[0] is None: return None
        p, n = hit[0], hit[1]
        if n.dot(Vector((0, lado, 0))) < 0: n = -n
        q = p + n * despegue
        v = self.bm.verts.new(q)
        _, idx, _ = self.kd.find(p)
        for g in self.fuente.data.vertices[idx].groups:
            if g.weight > 0.001: v[self.dl][g.group] = g.weight
        return v

    def figura(self, contorno, mat, despegue, anillos=3, lado=-1):
        """contorno: puntos (x, z) en orden; se rellena desde el centro con anillos para seguir la curva."""
        cx = sum(p[0] for p in contorno) / len(contorno); cz = sum(p[1] for p in contorno) / len(contorno)
        filas = [[self.punto(cx, cz, despegue, lado)]]
        for k in range(1, anillos + 1):
            t = k / anillos
            filas.append([self.punto(cx + (x - cx) * t, cz + (z - cz) * t, despegue, lado) for x, z in contorno])
        n = len(contorno)
        caras = []
        c = filas[0][0]
        for j in range(n):
            a, b = filas[1][j], filas[1][(j + 1) % n]
            if c and a and b: caras.append(self.bm.faces.new((c, a, b)))
        for k in range(1, anillos):
            A, B = filas[k], filas[k + 1]
            for j in range(n):
                q = (A[j], B[j], B[(j + 1) % n], A[(j + 1) % n])
                if all(q): caras.append(self.bm.faces.new(q))
        for f in caras:
            f.material_index = mat; f.smooth = True
        # que miren hacia afuera
        mira = Vector((0, lado, 0))
        al_reves = [f for f in caras if normal(f).dot(mira) < 0]
        if al_reves: bmesh.ops.reverse_faces(self.bm, faces=al_reves)

    def elipse(self, cx, cz, rx, rz, mat, despegue, seg=28, anillos=3, lado=-1):
        self.figura([(cx + rx * math.cos(2 * math.pi * i / seg), cz + rz * math.sin(2 * math.pi * i / seg)) for i in range(seg)], mat, despegue, anillos, lado)

    def rect(self, x0, z0, x1, z1, mat, despegue, div=6, lado=-1, curva=0.0):
        """Rectángulo; `curva` redondea el borde de abajo (solapa de bolsa)."""
        pts = []
        for i in range(div + 1): pts.append((x0 + (x1 - x0) * i / div, z1))
        for i in range(1, div + 1): pts.append((x1, z1 + (z0 - z1) * i / div))
        for i in range(1, div + 1):
            t = i / div; x = x1 + (x0 - x1) * t
            pts.append((x, z0 - curva * math.sin(math.pi * t)))
        for i in range(1, div): pts.append((x0, z0 + (z1 - z0) * i / div))
        self.figura(pts, mat, despegue, anillos=2, lado=lado)

    def rejilla(self, x0, z0, x1, z1, mat, despegue, nx=4, nz=12, lado=-1):
        """Rectángulo en cuadrícula: sigue bien la curva del pecho (sin triángulos largos que se ven más claros)."""
        V = [[self.punto(x0 + (x1 - x0) * i / nx, z0 + (z1 - z0) * j / nz, despegue, lado) for i in range(nx + 1)] for j in range(nz + 1)]
        caras = []
        for j in range(nz):
            for i in range(nx):
                q = (V[j][i], V[j][i + 1], V[j + 1][i + 1], V[j + 1][i])
                if all(q): caras.append(self.bm.faces.new(q))
        for f in caras: f.material_index = mat; f.smooth = True
        mira = Vector((0, lado, 0))
        al_reves = [f for f in caras if normal(f).dot(mira) < 0]
        if al_reves: bmesh.ops.reverse_faces(self.bm, faces=al_reves)

    def linea(self, puntos, ancho, mat, despegue, lado=-1):
        """Tira delgada que sigue `puntos` (costuras, cordones)."""
        izq, der = [], []
        for i, (x, z) in enumerate(puntos):
            a = puntos[max(0, i - 1)]; b = puntos[min(len(puntos) - 1, i + 1)]
            dx, dz = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dz) or 1
            nx, nz = -dz / L * ancho / 2, dx / L * ancho / 2
            izq.append(self.punto(x + nx, z + nz, despegue, lado)); der.append(self.punto(x - nx, z - nz, despegue, lado))
        caras = []
        for i in range(len(puntos) - 1):
            q = (izq[i], der[i], der[i + 1], izq[i + 1])
            if all(q): caras.append(self.bm.faces.new(q))
        for f in caras: f.material_index = mat
        mira = Vector((0, lado, 0))
        al_reves = [f for f in caras if normal(f).dot(mira) < 0]
        if al_reves: bmesh.ops.reverse_faces(self.bm, faces=al_reves)

    def juntar(self):
        """Agrega lo dibujado a la prenda (misma malla: así se ve y se esconde junto con ella)."""
        me = self.prenda.data
        bm = bmesh.new(); bm.from_mesh(me)
        tmp = bpy.data.meshes.new('tmp'); self.bm.to_mesh(tmp); self.bm.free()
        bm.from_mesh(tmp); bpy.data.meshes.remove(tmp)
        bm.to_mesh(me); bm.free()

def pesos_cercanos(o, verts_idx):
    """Copia a los vértices nuevos los pesos del vértice viejo más cercano (para piezas en 3D como la capucha)."""
    me = o.data
    viejos = [i for i in range(len(me.vertices)) if i not in verts_idx]
    kd = KDTree(len(viejos))
    for i in viejos: kd.insert(me.vertices[i].co, i)
    kd.balance()
    for i in verts_idx:
        _, j, _ = kd.find(me.vertices[i].co)
        for g in me.vertices[j].groups:
            if g.weight > 0.001: o.vertex_groups[g.group].add([i], g.weight, 'REPLACE')

def agregar_malla(o, construir):
    """Agrega a la prenda lo que construya `construir(bm)`; devuelve los índices de los vértices nuevos."""
    me = o.data
    n0 = len(me.vertices)
    bm = bmesh.new(); bm.from_mesh(me)
    construir(bm)
    bm.to_mesh(me); bm.free()
    return set(range(n0, len(me.vertices)))

# ================================================================ Sudadera con capucha y cara de oso
sud = copiar('Camisa_sudadera')
quitar_islas(sud, lambda m, z, n: es_cierre(m, z, n) or es_solapa(m, z, n))   # es cerrada: sin cierre ni solapas
OSO = new_mat('ropa_oso', '#8B5A3C', 0.8)
OSO_CLARO = new_mat('ropa_oso_claro', '#F2DDBE', 0.8)
OSO_NEGRO = new_mat('ropa_oso_negro', '#1E1E28', 0.4)
CORDON = new_mat('ropa_cordon', '#F4F4F4', 0.6)
mi = poner_mats(sud, [TINT, TINT_OSC, OSO, OSO_CLARO, OSO_NEGRO, CORDON])
I_TINT, I_OSC, I_OSO, I_OSOC, I_NEGRO, I_CORDON = range(6)
# toda la tela del color elegido (sin playera ni cierre: es cerrada); las costuras del hombro, en tono oscuro
nombres = [m.name for m in base.data.materials]
for p in sud.data.polygons:
    era = nombres[p.material_index].split('.')[0]
    p.material_index = I_OSC if era == 'tint_camisa_osc' else I_TINT

# cara de oso al centro del pecho y los cordones de la capucha
c = Calco(sud)
CX, CZ = 0.0, 0.565
c.elipse(CX - 0.056, CZ + 0.058, 0.03, 0.03, I_OSO, 0.006)            # orejas
c.elipse(CX + 0.056, CZ + 0.058, 0.03, 0.03, I_OSO, 0.006)
c.elipse(CX - 0.056, CZ + 0.058, 0.016, 0.016, I_OSOC, 0.008)
c.elipse(CX + 0.056, CZ + 0.058, 0.016, 0.016, I_OSOC, 0.008)
c.elipse(CX, CZ, 0.072, 0.064, I_OSO, 0.007, seg=36, anillos=4)       # cabeza
c.elipse(CX, CZ - 0.02, 0.032, 0.024, I_OSOC, 0.0095)                 # hocico
c.elipse(CX, CZ - 0.009, 0.012, 0.008, I_NEGRO, 0.0115, seg=18)        # nariz
c.linea([(CX, CZ - 0.017), (CX, CZ - 0.03)], 0.003, I_NEGRO, 0.0112)
c.linea([(CX - 0.013, CZ - 0.027), (CX - 0.007, CZ - 0.033), (CX, CZ - 0.031), (CX + 0.007, CZ - 0.033), (CX + 0.013, CZ - 0.027)], 0.003, I_NEGRO, 0.0112)
c.elipse(CX - 0.027, CZ + 0.017, 0.009, 0.01, I_NEGRO, 0.0095, seg=18)  # ojos
c.elipse(CX + 0.027, CZ + 0.017, 0.009, 0.01, I_NEGRO, 0.0095, seg=18)
c.elipse(CX - 0.024, CZ + 0.021, 0.003, 0.003, I_CORDON, 0.011, seg=10)  # brillito en los ojos
c.elipse(CX + 0.03, CZ + 0.021, 0.003, 0.003, I_CORDON, 0.011, seg=10)
for sx in (-1, 1):                                                       # cordones
    x0 = sx * 0.03
    c.linea([(x0, 0.715), (x0 + sx * 0.002, 0.69), (x0 + sx * 0.004, 0.665)], 0.006, I_CORDON, 0.007)
    c.elipse(x0 + sx * 0.004, 0.66, 0.006, 0.008, I_CORDON, 0.008, seg=12)
c.juntar()

# capucha caída sobre la espalda (elipsoide aplastado) y cuello redondo
def capucha(bm):
    antes = set(bm.faces)
    res = bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=1.0)
    M = Matrix.Diagonal((0.135, 0.05, 0.08))
    for v in res['verts']:
        v.co = Vector((0, 0.105, 0.668)) + M @ v.co
    for f in {f for v in res['verts'] for f in v.link_faces}:
        f.smooth = True
        n = normal(f); c = f.calc_center_median()
        # la abertura de la capucha (arriba, hacia atrás) se ve por dentro: tono oscuro
        f.material_index = I_OSC if (n.z > 0.55 and c.y > 0.11) else I_TINT
    # cuello: aro alrededor de la base del cuello
    R, r = 0.083, 0.02
    filas = []
    for i in range(32):
        a = 2 * math.pi * i / 32
        fila = []
        for j in range(8):
            b = 2 * math.pi * j / 8
            d = Vector((math.cos(a), math.sin(a) * 0.92, 0))
            fila.append(bm.verts.new(Vector((0, 0.004, 0.733)) + d * (R + r * math.cos(b)) + Vector((0, 0, r * 0.8 * math.sin(b)))))
        filas.append(fila)
    for i in range(32):
        A, B = filas[i], filas[(i + 1) % 32]
        for j in range(8):
            f = bm.faces.new((A[j], B[j], B[(j + 1) % 8], A[(j + 1) % 8]))
            f.material_index = I_TINT; f.smooth = True
    bmesh.ops.recalc_face_normals(bm, faces=[f for f in bm.faces if f not in antes])
nuevos = agregar_malla(sud, capucha)
pesos_cercanos(sud, nuevos)


# ================================================================ Chaqueta de mezclilla
mez = copiar('Camisa_mezclilla')
quitar_islas(mez, es_cierre)   # abierta: sin cierre; las solapas quedan como cuello de la chaqueta
SOLAPAS = caras_de_islas(mez, es_solapa)
MEZ = new_mat('ropa_mezclilla', '#4E78AE', 0.85)
MEZ_OSC = new_mat('ropa_mezclilla_osc', '#365A88', 0.85)
COSTURA = new_mat('ropa_costura', '#E0A040', 0.6)
BOTON = new_mat('ropa_boton', '#B87333', 0.3)
poner_mats(mez, [TINT, MEZ, MEZ_OSC, COSTURA, BOTON])
J_TINT, J_MEZ, J_OSC, J_COST, J_BOTON = range(5)
ABRE = 0.05   # media abertura del frente: ahí se ve la playera (del color elegido)
for p in mez.data.polygons:
    era = nombres[p.material_index].split('.')[0]
    cc = mez.matrix_world @ p.center
    if era == 'tint_camisa_osc' or cc.z < 0.45 or p.index in SOLAPAS: p.material_index = J_OSC   # costuras, pretina y cuello
    elif era == 'chico_blanco': p.material_index = J_TINT          # cuello de la playera
    elif era == 'chico_amarillo':
        # la playera solo se ve en la abertura del frente; arriba (bajo el cuello) es mezclilla
        # (y arriba, en la V entre las solapas)
        abierto = (abs(cc.x) < ABRE and cc.z < 0.655) or abs(cc.x) < (cc.z - 0.63) * 0.95
        p.material_index = J_TINT if abierto else J_MEZ
    else: p.material_index = J_MEZ

c = Calco(mez)
for sx in (-1, 1):
    # tapeta: tira de mezclilla en el borde de la abertura (tapa el borde dentado de la playera)
    c.rejilla(min(sx * (ABRE - 0.011), sx * (ABRE + 0.022)), 0.452, max(sx * (ABRE - 0.011), sx * (ABRE + 0.022)), 0.655, J_MEZ, 0.0025, nx=3, nz=16)
    # costura a lo largo de la abertura
    c.linea([(sx * (ABRE - 0.001), z / 1000) for z in range(456, 652, 14)], 0.0025, J_COST, 0.0045)
    # botones del frente
    for z in (0.47, 0.52, 0.57, 0.62):
        c.elipse(sx * (ABRE + 0.01), z, 0.0065, 0.0065, J_BOTON, 0.0062, seg=14, anillos=2)
    # bolsa del pecho con solapa en pico y su botón
    x0, x1 = sx * 0.072, sx * 0.118
    x0, x1 = min(x0, x1), max(x0, x1)
    c.rejilla(x0, 0.555, x1, 0.6, J_MEZ, 0.005, nx=5, nz=5)
    c.linea([(x0 + 0.003, 0.6), (x0 + 0.003, 0.558), (x1 - 0.003, 0.558), (x1 - 0.003, 0.6)], 0.0022, J_COST, 0.0062)
    c.rect(x0 - 0.002, 0.6, x1 + 0.002, 0.625, J_OSC, 0.0072, curva=0.012)
    c.linea([(x0, 0.6 - 0.001), ((x0 + x1) / 2, 0.588), (x1, 0.6 - 0.001)], 0.0022, J_COST, 0.0085)
    c.elipse((x0 + x1) / 2, 0.598, 0.006, 0.006, J_BOTON, 0.0092, seg=14, anillos=2)
c.juntar()

for o in (sud, mez):
    for p in o.data.polygons: p.use_smooth = True
    print(o.name, 'verts', len(o.data.vertices), 'tris', sum(len(p.vertices) - 2 for p in o.data.polygons))

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
