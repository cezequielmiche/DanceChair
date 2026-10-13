"""Chico y chica para el juego, con piezas intercambiables entre los dos.
Etapa A:  python bl_kids.py A entrada.blend salida_piezas.blend chico|chica
Etapa B:  python bl_kids.py B piezas_propias.blend piezas_otro.blend salida.blend salida.glb
Piezas (nombre de malla = Grupo_valor): Cuerpo, Pelo_corto, Pelo_largo, Camisa_chaqueta, Camisa_blusa,
Pant_jeans, Pant_falda, Zap_tenis, Zap_zapatos, Acc_lentes, Acc_audifonos."""
import bpy, bmesh, sys, os, math
from mathutils import Vector, Quaternion, Matrix
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import anim_lib as AL

STAGE = sys.argv[1]
SCALE = 1.46   # igual para los dos: así las piezas encajan en ambos cuerpos

def sel(objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
def tris(o):
    dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); m = e.to_mesh()
    t = sum(len(p.vertices) - 2 for p in m.polygons); e.to_mesh_clear(); return t
def new_mat(name, hex_, rough=0.7):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    h = hex_.lstrip('#'); c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    lin = [x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    m.diffuse_color = (*lin, 1); m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    if bs: bs.inputs['Base Color'].default_value = (*lin, 1); bs.inputs['Roughness'].default_value = rough
    return m
def attach(o, arm):
    o.parent = arm
    mods = [m for m in o.modifiers if m.type == 'ARMATURE']
    if mods:
        for m in mods: m.object = arm
    else:
        mm = o.modifiers.new('Armature', 'ARMATURE'); mm.object = arm

# ---------------------------------------------------------------- Etapa A
if STAGE == 'A':
    src, out, KIND = sys.argv[2], sys.argv[3], sys.argv[4]
    bpy.ops.wm.open_mainfile(filepath=src)
    scene = bpy.context.scene
    arm = bpy.data.objects['Esqueleto']
    for o in list(bpy.data.objects):
        if o.type in ('LIGHT', 'CAMERA'): bpy.data.objects.remove(o, do_unlink=True)
    if arm.animation_data: arm.animation_data.action = None
    for a in list(bpy.data.actions): bpy.data.actions.remove(a)
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'; pb.rotation_quaternion = Quaternion(); pb.location = Vector(); pb.scale = Vector((1, 1, 1))
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    print('ANTES', sum(tris(o) for o in meshes))
    for o in meshes:
        for m in o.modifiers:
            if m.type == 'SUBSURF': m.levels = min(m.levels, 1)
            if m.type == 'BEVEL': m.segments = 1
    for o in meshes:
        sel([o])
        for m in list(o.modifiers):
            if m.type != 'ARMATURE':
                try: bpy.ops.object.modifier_apply(modifier=m.name)
                except Exception as e: print('no se aplicó', o.name, m.name, e)
    for o in meshes:
        t = tris(o)
        n = o.name
        if n == 'Cuerpo': target = 14000
        elif n == 'Pelo': target = 2400
        elif n.startswith(('Ojo', 'Iris')): target = 260
        elif n.startswith(('Pelo_Largo', 'Pelo_Atras', 'Flequillo', 'Mechon', 'Punta')): target = 300
        else: target = 140
        if t > target:
            sel([o]); d = o.modifiers.new('dec', 'DECIMATE'); d.ratio = target / t
            bpy.ops.object.modifier_apply(modifier=d.name)
    # huesos tipo Mixamo
    REN = {'hips': 'Hips', 'spine': 'Spine', 'head': 'Head'}
    for s, S in (('L', 'Left'), ('R', 'Right')):
        REN.update({f'shoulder.{s}': S + 'Shoulder', f'upper_arm.{s}': S + 'Arm', f'forearm.{s}': S + 'ForeArm', f'hand.{s}': S + 'Hand',
                    f'thigh.{s}': S + 'UpLeg', f'shin.{s}': S + 'Leg', f'foot.{s}': S + 'Foot'})
    for old, new in REN.items():
        b = arm.data.bones.get(old)
        if b: b.name = new
    for o in meshes:
        for vg in o.vertex_groups:
            if vg.name in REN: vg.name = REN[vg.name]

    # Clasificar cada cara del cuerpo en una pieza
    body = bpy.data.objects['Cuerpo']
    mats = [m.name for m in body.data.materials]
    def face_piece(mat, c):
        ax = abs(c.x) > 0.13
        if mat in ('piel', 'piel_osc'): return 'Cuerpo'
        if KIND == 'chico':
            if mat in ('rojo', 'rojo_osc'): return 'Camisa_chaqueta'
            if mat == 'amarillo': return 'Zap_tenis' if c.z < 0.2 else 'Camisa_chaqueta'
            if mat == 'jean': return 'Pant_jeans'
            if mat == 'celeste': return 'Zap_tenis'
            if mat == 'blanco': return 'Zap_tenis' if c.z < 0.2 else 'Camisa_chaqueta'
        else:
            if mat == 'blanco': return 'Camisa_blusa' if c.z > 0.27 else ('Zap_zapatos' if c.z < 0.075 else 'Pant_falda')
            if mat == 'rojo': return 'Camisa_blusa' if c.z > 0.45 else 'Pant_falda'
            if mat == 'celeste': return 'Camisa_blusa' if ax and c.z > 0.22 else ('Zap_zapatos' if c.z < 0.12 else 'Pant_falda')
        return 'Cuerpo'
    sel([body]); bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(body.data)
    groups = {}
    for f in bm.faces:
        c = body.matrix_world @ f.calc_center_median()
        groups.setdefault(face_piece(mats[f.material_index], c), []).append(f.index)
    bpy.ops.object.mode_set(mode='OBJECT')
    print('CARAS', {k: len(v) for k, v in groups.items()})
    for piece, idxs in groups.items():
        if piece == 'Cuerpo': continue
        sel([body]); bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='DESELECT')
        bm = bmesh.from_edit_mesh(body.data); bm.faces.ensure_lookup_table()
        S = set(idxs)
        # los índices cambian al separar: se recalculan por clasificación
        for f in bm.faces:
            c = body.matrix_world @ f.calc_center_median()
            f.select = face_piece(body.data.materials[f.material_index].name, c) == piece
        bmesh.update_edit_mesh(body.data)
        bpy.ops.mesh.separate(type='SELECTED'); bpy.ops.object.mode_set(mode='OBJECT')
        for n in bpy.context.selected_objects:
            if n is not body: n.name = 'P__' + piece + '__x'

    def obj_piece(n):
        if n.startswith('P__'): return n.split('__')[1]
        if n == 'Cuerpo': return 'Cuerpo'
        HAIR = ('Pelo', 'Flequillo', 'Brillo_Pelo', 'Mechon', 'Punta')
        if n.startswith(HAIR): return 'Pelo_corto' if KIND == 'chico' else 'Pelo_largo'
        if n.startswith(('Solapa', 'Costura', 'Cierre')): return 'Camisa_chaqueta' if KIND == 'chico' else 'Camisa_blusa'
        return 'Cuerpo'
    for side in ('L', 'R'):
        eo = bpy.data.objects.get('Ojo.' + side)
        if eo:
            vs = [eo.matrix_world @ v.co for v in eo.data.vertices]
            c = sum(vs, Vector()) / len(vs); r = max((v - c).length for v in vs)
            arm['ojo_' + side] = [c.x * SCALE, c.y * SCALE, c.z * SCALE, r * SCALE]
    P = {}
    for o in bpy.data.objects:
        if o.type == 'MESH': P.setdefault(obj_piece(o.name), []).append(o)
    print('PIEZAS', {k: len(v) for k, v in P.items()})
    pieces = {}
    for name, objs in P.items():
        sel(objs); bpy.ops.object.join()
        o = bpy.context.view_layer.objects.active; o.name = name; o.data.name = name
        attach(o, arm); pieces[name] = o

    # Materiales del juego, por pieza (el mismo material original puede ir a piezas distintas)
    TINT = {
        'Cuerpo': {'piel': 'piel', 'piel_osc': 'piel_osc', 'iris': 'ojos_iris', 'iris_cafe': 'ojos_iris'},
        'Pelo_corto': {'pelo_azul': 'tint_pelo', 'brillo_azul': 'tint_pelo_claro'},
        'Pelo_largo': {'pelo_naranja': 'tint_pelo', 'brillo_naranja': 'tint_pelo_claro'},
        'Camisa_chaqueta': {'rojo': 'tint_camisa', 'rojo_osc': 'tint_camisa_osc'},
        'Camisa_blusa': {'blanco': 'tint_camisa'},
        'Pant_jeans': {'jean': 'tint_pantalon'},
        'Pant_falda': {'rojo': 'tint_pantalon'},
        'Zap_tenis': {'amarillo': 'tint_tenis'},
        'Zap_zapatos': {'celeste': 'tint_zapato'},
    }
    for pname, o in pieces.items():
        mp = TINT.get(pname, {})
        for i, m in enumerate(o.data.materials):
            if m and m.name in mp:
                nm = bpy.data.materials.get(mp[m.name]) or m.copy()
                nm.name = mp[m.name]; o.data.materials[i] = nm
            elif m and not m.name.startswith(KIND + '_') and pname != 'Cuerpo' and m.name not in ('piel',):
                # materiales fijos: nombre propio del personaje para no mezclarse al juntar
                c = m.copy(); c.name = KIND + '_' + m.name; o.data.materials[i] = c
    # Pantalón y falda: sin pesos de brazos/manos (si no, se estiran al subir los brazos)
    ARMB = ('Shoulder', 'Arm', 'ForeArm', 'Hand')
    for pname in ('Pant_jeans', 'Pant_falda'):
        o = pieces.get(pname)
        if not o: continue
        bad = {g.index for g in o.vertex_groups if g.name.endswith(ARMB)}
        keep_hips = o.vertex_groups.get('Hips') or o.vertex_groups.new(name='Hips')
        for v in o.data.vertices:
            gs = [(g.group, g.weight) for g in v.groups]
            if not any(gi in bad for gi, w in gs): continue
            for gi, w in gs:
                if gi in bad: o.vertex_groups[gi].remove([v.index])
            if not any(g.group not in bad and g.weight > 0 for g in v.groups):
                keep_hips.add([v.index], 1.0, 'REPLACE')
    print('PIEZAS FINALES', {k: tris(o) for k, o in pieces.items()})
    # escala común
    arm.scale = (SCALE, SCALE, SCALE)
    sel([arm]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for o in pieces.values():
        sel([o]); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.wm.save_as_mainfile(filepath=out, compress=True)
    print('ETAPA A OK', out)

# ---------------------------------------------------------------- Etapa B
else:
    mine, other, out_blend, out_glb = sys.argv[2:6]
    bpy.ops.wm.open_mainfile(filepath=mine)
    scene = bpy.context.scene
    arm = bpy.data.objects['Esqueleto']
    have = {o.name for o in bpy.data.objects if o.type == 'MESH'}
    with bpy.data.libraries.load(other, link=False) as (s_, d_):
        d_.objects = [n for n in s_.objects if n != 'Cuerpo' and n != 'Esqueleto' and n not in have]
    for o in d_.objects:
        if o is None or o.type != 'MESH': continue
        scene.collection.objects.link(o)
        attach(o, arm)
    for o in list(bpy.data.objects):
        if o.type == 'ARMATURE' and o is not arm: bpy.data.objects.remove(o, do_unlink=True)

    # Cabeza: centro y tamaño a partir de la piel con peso de cabeza
    body = bpy.data.objects['Cuerpo']
    hi = body.vertex_groups['Head'].index
    hv = [body.matrix_world @ v.co for v in body.data.vertices if any(g.group == hi and g.weight > 0.9 for g in v.groups)]
    mn = Vector((min(p.x for p in hv), min(p.y for p in hv), min(p.z for p in hv)))
    mx = Vector((max(p.x for p in hv), max(p.y for p in hv), max(p.z for p in hv)))
    hc = (mn + mx) / 2; hr = (mx - mn) / 2
    print('CABEZA', hc, hr)
    def center(o):
        dg = bpy.context.evaluated_depsgraph_get(); e = o.evaluated_get(dg); m = e.to_mesh()
        c = sum((o.matrix_world @ v.co for v in m.vertices), Vector()) / len(m.vertices)
        r = max((o.matrix_world @ v.co - c).length for v in m.vertices); e.to_mesh_clear(); return c, r
    EC = [(Vector(arm['ojo_' + s][:3]), arm['ojo_' + s][3]) for s in ('L', 'R') if ('ojo_' + s) in arm.keys()]
    print('OJOS', EC)

    def make(name, build, mat):
        bm = bmesh.new(); build(bm)
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(name, me); scene.collection.objects.link(o)
        me.materials.append(mat)
        for p in me.polygons: p.use_smooth = True
        o.vertex_groups.new(name='Head').add([v.index for v in me.vertices], 1.0, 'REPLACE')
        attach(o, arm); return o
    def ring(bm, c, R, r, axis_m, seg=24, sides=8, a0=0, a1=2 * math.pi, close=True):
        rows = []
        n = seg if close else seg + 1
        for i in range(n):
            a = a0 + (a1 - a0) * i / seg
            cc = Vector((math.cos(a) * R, math.sin(a) * R, 0))
            out = Vector((math.cos(a), math.sin(a), 0))
            row = []
            for j in range(sides):
                b = 2 * math.pi * j / sides
                p = cc + out * math.cos(b) * r + Vector((0, 0, 1)) * math.sin(b) * r
                row.append(bm.verts.new(c + axis_m @ p))
            rows.append(row)
        for i in range(len(rows) - (0 if close else 1)):
            A, B = rows[i], rows[(i + 1) % len(rows)]
            for j in range(sides):
                bm.faces.new([A[j], A[(j + 1) % sides], B[(j + 1) % sides], B[j]])
    # Lentes redondos frente a los ojos
    if len(EC) == 2:
        er = max(r for c, r in EC)
        front = Matrix.Rotation(math.radians(90), 3, 'X')   # aro de frente (plano XZ)
        def lentes(bm):
            for c, r in EC:
                ring(bm, c + Vector((0, -r * 0.55, 0)), er * 1.15, er * 0.11, front)
            a, b = EC[0][0], EC[1][0]
            mid = (a + b) / 2 + Vector((0, -er * 0.6, er * 0.15))
            span = abs(a.x - b.x) / 2 - er * 1.15
            ring(bm, mid + Vector((0, 0, -span * 0.2)), span * 1.1, er * 0.08, front, seg=8, a0=math.radians(20), a1=math.radians(160), close=False)
            for c, r in EC:   # patillas hacia las orejas
                sx = 1 if c.x > 0 else -1
                p0 = c + Vector((sx * er * 1.15, -r * 0.55, 0))
                p1 = Vector((sx * hr.x * 1.02, hc.y + hr.y * 0.15, c.z + er * 0.1))
                d = (p1 - p0); L = d.length; d.normalize()
                up = Vector((0, 0, 1)); side = d.cross(up).normalized(); up = side.cross(d)
                r0 = er * 0.08
                vs = []
                for t in (0, 1):
                    for j in range(6):
                        b = 2 * math.pi * j / 6
                        vs.append(bm.verts.new(p0 + d * L * t + (side * math.cos(b) + up * math.sin(b)) * r0))
                for j in range(6):
                    bm.faces.new([vs[j], vs[(j + 1) % 6], vs[6 + (j + 1) % 6], vs[6 + j]])
        make('Acc_lentes', lentes, new_mat('acc_marco', '#1E1E28', 0.4))
    # Audífonos: diadema por arriba y dos copas a los lados
    # Audífonos: diadema por arriba y dos copas a los lados. Dos tallas: para pelo corto y para pelo largo (más voluminoso)
    def build_audif(name, rx, top, cupx):
        def audif(bm):
            ring(bm, Vector((hc.x, hc.y + hr.y * 0.05, hc.z + hr.z * 0.02)), rx, hr.x * 0.06,
                 Matrix.Rotation(math.radians(90), 3, 'X'), seg=16, sides=8, a0=math.radians(-10), a1=math.radians(190), close=False)
            for sx in (1, -1):
                c = Vector((hc.x + sx * cupx, hc.y + hr.y * 0.05, hc.z - hr.z * 0.08))
                R = hr.z * 0.32
                res = bmesh.ops.create_cone(bm, cap_ends=True, segments=16, radius1=R, radius2=R * 0.9, depth=hr.x * 0.18)
                bmesh.ops.transform(bm, matrix=Matrix.Translation(c) @ Matrix.Rotation(math.radians(90), 4, 'Y'), verts=res['verts'])
        au = make(name, audif, new_mat('tint_acc', '#FFC233', 0.5))
        kz = (top - hc.z) / rx
        for v in au.data.vertices:   # la diadema sigue la forma de la cabeza (más baja que ancha)
            if v.co.z > hc.z + hr.z * 0.05: v.co.z = hc.z + (v.co.z - hc.z) * kz
        return au
    build_audif('Acc_audifonos', hr.x * 1.08, hc.z + hr.z * 1.12, hr.x * 1.04)
    hl = bpy.data.objects.get('Pelo_largo')
    if hl:
        pts = [hl.matrix_world @ v.co for v in hl.data.vertices]
        up = [p for p in pts if p.z > hc.z - hr.z * 0.3]
        hx = max(abs(p.x - hc.x) for p in up); hz = max(p.z for p in pts)
        build_audif('Acc_audifonosl', max(hr.x * 1.08, hx * 1.04), max(hc.z + hr.z * 1.12, hz + hr.z * 0.06), max(hr.x * 1.04, hx * 1.0))
        print('AUDIFONOS PELO LARGO', hx, hz)

    pieces = {o.name: o for o in bpy.data.objects if o.type == 'MESH'}
    print('PIEZAS', sorted(pieces))
    # Bailes
    scene.render.fps = 24
    pb = arm.pose.bones
    for b in pb: b.rotation_mode = 'QUATERNION'
    arm.animation_data_create()
    def rest_angle(side):
        bo = arm.data.bones[side + 'Arm']; d = bo.tail_local - bo.head_local
        return math.degrees(math.atan2(abs(d.x), -d.z))
    RA = {s: rest_angle(s) for s in ('Left', 'Right')}
    REST_OPEN = 22
    def arm_rot(side, deg):
        if side == 'Right': return AL.rot_world_axis(pb['RightArm'], deg + REST_OPEN - RA['Right'])
        return AL.rot_world_axis(pb['LeftArm'], deg - REST_OPEN + RA['Left'])
    for clip, beats in AL.CLIPS:
        act = bpy.data.actions.new(clip); act.use_fake_user = True
        arm.animation_data.action = act
        key = AL.KEYMAP.get(clip, clip)
        for f in range(0, beats * AL.BEAT + 1, 2):
            aL, eL, aR, eR, tilt, hip, lL, lR, hd, bob = AL.pose_at(key, f / AL.BEAT)
            pb['RightArm'].rotation_quaternion = arm_rot('Right', aL)
            pb['RightForeArm'].rotation_quaternion = AL.rot_world_axis(pb['RightForeArm'], eL)
            pb['LeftArm'].rotation_quaternion = arm_rot('Left', aR)
            pb['LeftForeArm'].rotation_quaternion = AL.rot_world_axis(pb['LeftForeArm'], eR)
            pb['RightUpLeg'].rotation_quaternion = AL.rot_world_axis(pb['RightUpLeg'], lL)
            pb['LeftUpLeg'].rotation_quaternion = AL.rot_world_axis(pb['LeftUpLeg'], lR)
            pb['Spine'].rotation_quaternion = AL.rot_world_axis(pb['Spine'], tilt)
            pb['Head'].rotation_quaternion = AL.rot_world_axis(pb['Head'], hd * 0.7)
            pb['Hips'].location = AL.loc_world(pb['Hips'], (hip * 0.6, 0, bob * 0.6))
            for bn in ('RightArm', 'RightForeArm', 'LeftArm', 'LeftForeArm', 'RightUpLeg', 'LeftUpLeg', 'Spine', 'Head'):
                pb[bn].keyframe_insert('rotation_quaternion', frame=f)
            pb['Hips'].keyframe_insert('location', frame=f)
    arm.animation_data.action = bpy.data.actions['idle']
    bpy.ops.wm.save_as_mainfile(filepath=out_blend, compress=True)
    bpy.ops.object.select_all(action='DESELECT')
    arm.select_set(True)
    for o in pieces.values(): o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=out_glb, export_format='GLB', use_selection=True, export_yup=True,
                              export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
                              export_cameras=False, export_lights=False, export_apply=False)
    print('EXPORT OK', out_glb, 'tris', sum(tris(o) for o in pieces.values()), {k: tris(o) for k, o in pieces.items()})
