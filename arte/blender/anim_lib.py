import math
from mathutils import Vector, Quaternion
BEAT = 10
def ease(t):
    return t * t * (3 - 2 * t)

def blend(keys, ph, mf):
    i = int(math.floor(ph)) % len(keys); j = (i + 1) % len(keys)
    t = ease(min(1.0, (ph - math.floor(ph)) / mf))
    return [a + (b - a) * t for a, b in zip(keys[i], keys[j])]

def pose_at(name, ph):
    """Devuelve [brazoD_pantalla(-X), codo, brazo(+X), codo, inclinación, cadera, piernaD, piernaI, cabeza, bob]
    con la misma convención que el avatar 2D (grados de giro alrededor del eje frontal)."""
    s = math.sin(math.pi * ph); groove = abs(s)
    if name == 'idle':
        b = math.sin(ph * math.pi / 4) * 0.008
        return [4, 8, -4, -8, math.sin(ph * math.pi / 4) * 1.5, 0, 0, 0, math.sin(ph * math.pi / 4) * 2, b]
    if name == 'caminar':
        w = math.sin(math.pi * ph)
        return [-w * 20, 8, w * 20, -8, 0, w * 0.01, w * 14, -w * 14, w * 2.5, -abs(math.cos(math.pi * ph)) * 0.015]
    if name == 'brazos':
        return [150 + s * 14, 18 + s * 16, -150 + s * 14, -18 + s * 16, s * 3 - s * 2.2 * 1.6 * 0.3, s * 0.022, s * 4, s * 4, s * 7, -groove * 0.02]
    if name == 'balanceo':
        w = math.sin(math.pi * ph / 2)
        return [95 + w * 22, w * 22, -95 + w * 22, w * 22, w * 7 - w * 3.4 * 1.6 * 0.3, w * 0.034, max(0, w) * 9, min(0, w) * 9, -w * 9, -groove * 0.012]
    if name == 'disco':
        K = blend([[30, -60, -150, -8, -5, 0.03, 0, -9, -8], [30, -60, 35, 30, 5, -0.03, 0, 0, 6]], ph, 0.45)
        return K + [-groove * 0.017]
    if name == 'robot':
        K = blend([[90, 90, -90, -90, 0, 0, 0, 0, 0], [90, -90, -90, 90, -3, 0.018, 6, 0, 10], [60, 90, -120, -90, 0, 0, 0, 0, 0], [120, -90, -60, 90, 3, -0.018, 0, -6, -10]], ph, 0.3)
        return K + [-groove * 0.007]
    if name == 'macarena':
        K = blend([[6, 6, -90, 0, 0, 0, 0, 0, 4], [90, 0, -90, 0, 0, 0, 0, 0, -4], [96, -10, -96, 10, 0, 0, 0, 0, 0],
                   [96, -10, 40, 110, 0, 0, 0, 0, -8], [-40, -110, 40, 110, 0, 0, 0, 0, 8], [150, 80, -150, -80, 0, 0, 0, 0, 0],
                   [30, -70, -30, 70, 0, 0, 0, 0, 0], [30, -70, -30, 70, 0, 0, 0, 0, 0]], ph, 0.55)
        if int(math.floor(ph)) % 8 == 7:
            hip = math.sin(math.pi * ph * 2)
            K[4] = hip * 8; K[5] = hip * 0.042; K[6] = hip * 4; K[7] = hip * 4; K[8] = -hip * 10
        else:
            K[5] = s * 0.02
        return K + [-groove * 0.015]
    if name == 'aura':
        K = blend([[18, -18, -118, -62, 0, 0, 0, 0, -7], [18, -18, -72, 48, 0, 0, 0, 0, -3],
                   [118, 62, -18, 18, 0, 0, 0, 0, 7], [72, -48, -18, 18, 0, 0, 0, 0, 3]], ph, 0.85)
        K[5] = math.sin(math.pi * ph / 2) * 0.03
        return K + [-groove * 0.008]
    if name == 'dab':
        P1 = [4, 8, 25, 130, 0, 0, 0, 0, -9]; P2 = [82, 10, 22, 150, 6, -0.026, 4, -32, 7]
        P3 = [38, -35, -38, 35, 0, 0, 15, -15, -4]; P4 = [140, 0, 150, -45, -4, 0.016, 0, 0, 10]
        K = blend([P1, P1, P2, P2, P3, P3, P4, P4], ph, 0.35)
        squat = blend([[0], [0], [0], [0], [0.032], [0.032], [0], [0]], ph, 0.35)[0]
        return K + [-groove * 0.005 - squat]
    return [0] * 10

CLIPS = [('idle', 4), ('caminar', 2), ('paso_brazos', 4), ('paso_balanceo', 4), ('paso_disco', 4),
         ('paso_robot', 4), ('paso_macarena', 8), ('paso_aura', 4), ('paso_combo_dab', 8)]
KEYMAP = {'paso_brazos': 'brazos', 'paso_balanceo': 'balanceo', 'paso_disco': 'disco', 'paso_robot': 'robot',
          'paso_macarena': 'macarena', 'paso_aura': 'aura', 'paso_combo_dab': 'dab'}

FWD = Vector((0, 1, 0))  # giro "de lado" = alrededor del eje frontal (Y en Blender)

def rot_world_axis(pbone, deg):
    """Rotación local equivalente a girar 'deg' alrededor del eje frontal del mundo (en reposo)."""
    axis = pbone.bone.matrix_local.to_3x3().inverted() @ FWD
    return Quaternion(axis.normalized(), math.radians(deg))

def loc_world(pbone, vec):
    return pbone.bone.matrix_local.to_3x3().inverted() @ Vector(vec)

