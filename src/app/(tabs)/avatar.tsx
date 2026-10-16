// Creador de avatar: cuerpo, pelo, ropa, disfraz y extras. Los cambios se guardan solos.
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar3D } from '@/avatar/Avatar3D';
import { AVATAR_CHICA, AVATAR_CHICO, type AvatarAnim, type AvatarConfig, type CamisaTipo, type Disfraz } from '@/avatar/types';
import { COLORES, PRENDAS } from '@/data/catalogo';
import { useJugar } from '@/lib/useJugar';
import { useJugador } from '@/store/jugador';
import { Boton, Etiqueta, Interruptor, Muestras, Opciones, Pestanas } from '@/ui/comunes';
import { Candado } from '@/ui/iconos';
import { C, F } from '@/ui/tema';

type Tab = 'cuerpo' | 'pelo' | 'ropa' | 'extras';

export default function Creador() {
  const { avatar: a, setAvatar, nombre, setNombre, tiene } = useJugador();
  const { jugar, revisando } = useJugar();
  const [tab, setTab] = useState<Tab>('cuerpo');
  const [pose, setPose] = useState<AvatarAnim>('idle');
  const set = <K extends keyof AvatarConfig>(k: K, v: AvatarConfig[K]) => setAvatar({ ...a, [k]: v });
  const tieneLentes = tiene.includes('lentes');
  const tieneAudif = tiene.includes('audifonos');
  const disfraces = PRENDAS.filter((p) => p.slot === 'disfraz');
  const misDisfraces = disfraces.filter((p) => tiene.includes(p.id));
  const arriba = partesDeArriba(tiene);
  const arribaPago = PRENDAS.filter((p) => p.slot === 'camisaTipo' && p.precio > 0);
  const alAzar = () => setAvatar(avatarAlAzar(tiene));

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <View style={styles.cabeza}>
        <Text style={styles.titulo}>Tu avatar</Text>
        <Pressable onPress={alAzar} style={styles.chipBtn} accessibilityRole="button">
          <Text style={styles.chipTxt}>Al azar</Text>
        </Pressable>
      </View>
      <Avatar3D avatares={[{ config: a, anim: pose }]} style={{ height: 250 }} />
      <View style={{ paddingHorizontal: 16, gap: 10 }}>
        <Opciones<AvatarAnim> items={[['idle', 'Parado'], ['caminar', 'Caminando'], ['brazos', 'Bailando']]} valor={pose} onCambio={setPose} />
        <Pestanas<Tab> items={[['cuerpo', 'Cuerpo'], ['pelo', 'Pelo'], ['ropa', 'Ropa'], ['extras', 'Extras']]} valor={tab} onCambio={setTab} />
      </View>
      <ScrollView contentContainerStyle={styles.panel}>
        {tab === 'cuerpo' && (
          <>
            <Etiqueta>Nombre de jugador</Etiqueta>
            <TextInput value={nombre} onChangeText={setNombre} maxLength={12} style={styles.input} placeholder="Tu nombre" placeholderTextColor={C.apagado2} />
            <Etiqueta>Cuerpo</Etiqueta>
            <Opciones
              items={[['hombre', 'Chico'], ['mujer', 'Chica']]}
              valor={a.cuerpo}
              // al cambiar de cuerpo se pone el conjunto propio de ese cuerpo (se conservan piel, ojos y extras)
              onCambio={(c) => {
                const base = c === 'mujer' ? AVATAR_CHICA : AVATAR_CHICO;
                setAvatar({ ...a, cuerpo: c, pelo: base.pelo, colorPelo: base.colorPelo, camisaTipo: base.camisaTipo, camisa: base.camisa, pantalonTipo: base.pantalonTipo, pantalon: base.pantalon, zapatos: base.zapatos, colorZapatos: base.colorZapatos });
              }}
            />
            <Etiqueta>Tono de piel</Etiqueta>
            <Muestras colores={COLORES.piel} valor={a.piel} onCambio={(c) => set('piel', c)} />
            <Etiqueta>Color de ojos</Etiqueta>
            <Muestras colores={COLORES.colorOjos} valor={a.colorOjos} onCambio={(c) => set('colorOjos', c)} />
          </>
        )}
        {tab === 'pelo' && (
          <>
            <Etiqueta>Largo</Etiqueta>
            <Opciones items={[['corto', 'Corto'], ['largo', 'Largo'], ['ninguno', 'Sin pelo']]} valor={a.pelo ?? 'corto'} onCambio={(v) => set('pelo', v)} />
            <Etiqueta>Color de pelo</Etiqueta>
            <Muestras colores={COLORES.colorPelo} valor={a.colorPelo} onCambio={(c) => set('colorPelo', c)} />
          </>
        )}
        {tab === 'ropa' && (
          <>
            <Etiqueta>Parte de arriba</Etiqueta>
            <Opciones items={arriba} valor={a.camisaTipo ?? (a.cuerpo === 'mujer' ? 'blusa' : 'chaqueta')} onCambio={(v) => set('camisaTipo', v)} />
            {arribaPago
              .filter((p) => !tiene.includes(p.id))
              .map((p) => (
                <Bloqueado key={p.id} texto={p.nombre} onPress={() => router.push({ pathname: '/tienda', params: { sel: p.id } })} />
              ))}
            <Etiqueta>Color de arriba</Etiqueta>
            <Muestras colores={COLORES.camisa} valor={a.camisa} onCambio={(c) => set('camisa', c)} />
            <Etiqueta>Parte de abajo</Etiqueta>
            <Opciones items={[['jeans', 'Jeans'], ['falda', 'Falda']]} valor={a.pantalonTipo ?? 'jeans'} onCambio={(v) => set('pantalonTipo', v)} />
            <Etiqueta>Color de abajo</Etiqueta>
            <Muestras colores={COLORES.pantalon} valor={a.pantalon} onCambio={(c) => set('pantalon', c)} />
            <Etiqueta>Zapatos</Etiqueta>
            <Opciones items={[['tenis', 'Tenis'], ['zapatos', 'Zapatos']]} valor={a.zapatos ?? 'tenis'} onCambio={(v) => set('zapatos', v)} />
            <Etiqueta>Color de zapatos</Etiqueta>
            <Muestras colores={COLORES.colorZapatos} valor={a.colorZapatos} onCambio={(c) => set('colorZapatos', c)} />
            <Etiqueta>Disfraz (va encima de tu ropa)</Etiqueta>
            {misDisfraces.length > 0 && (
              <>
                <Opciones<Disfraz>
                  items={[['ninguno', 'Ninguno'], ...misDisfraces.map((p) => [p.val as Disfraz, p.nombre] as [Disfraz, string])]}
                  valor={a.disfraz ?? 'ninguno'}
                  onCambio={(v) => set('disfraz', v)}
                />
                {a.disfraz && a.disfraz !== 'ninguno' && (
                  <>
                    <Etiqueta>{a.disfraz === 'pinguino' ? 'Color de la bufanda' : 'Color del dino'}</Etiqueta>
                    <Muestras colores={COLORES.colorDisfraz} valor={a.colorDisfraz} onCambio={(c) => set('colorDisfraz', c)} />
                  </>
                )}
              </>
            )}
            {disfraces
              .filter((p) => !tiene.includes(p.id))
              .map((p) => (
                <Bloqueado key={p.id} texto={`Disfraz de ${p.nombre.toLowerCase()}`} onPress={() => router.push({ pathname: '/tienda', params: { sel: p.id } })} />
              ))}
          </>
        )}
        {tab === 'extras' && (
          <>
            <Etiqueta>Accesorios</Etiqueta>
            <View style={styles.caja}>
              {tieneLentes ? <Interruptor titulo="Lentes" valor={a.lentes === 'si'} onCambio={(v) => set('lentes', v ? 'si' : 'no')} /> : <Bloqueado texto="Lentes" onPress={() => router.push('/tienda')} />}
              {tieneAudif ? (
                <Interruptor titulo="Audífonos" valor={a.audifonos === 'si'} onCambio={(v) => set('audifonos', v ? 'si' : 'no')} />
              ) : (
                <Bloqueado texto="Audífonos" onPress={() => router.push('/tienda')} />
              )}
            </View>
            {tieneAudif && (
              <>
                <Etiqueta>Color de audífonos</Etiqueta>
                <Muestras colores={COLORES.colorAcc} valor={a.colorAcc} onCambio={(c) => set('colorAcc', c)} />
              </>
            )}
          </>
        )}
      </ScrollView>
      <View style={{ padding: 16, paddingTop: 8 }}>
        <Boton titulo={revisando ? 'Revisando conexión…' : 'Guardar y jugar'} deshabilitado={revisando} onPress={() => jugar()} />
      </View>
    </SafeAreaView>
  );
}

/** Partes de arriba que puede elegir: las gratis y las de pago que ya compró (las demás salen con candado). */
function partesDeArriba(tiene: string[]): [CamisaTipo, string][] {
  const corto: Record<string, string> = { sudadera: 'Sudadera', mezclilla: 'Mezclilla' };
  return [
    ['chaqueta', 'Chaqueta'],
    ['blusa', 'Blusa'],
    ...PRENDAS.filter((p) => p.slot === 'camisaTipo' && p.precio > 0 && tiene.includes(p.id)).map((p) => [p.val as CamisaTipo, corto[p.id] ?? p.nombre] as [CamisaTipo, string]),
  ];
}

/** Avatar al azar con lo que tiene (fuera del componente: Math.random no puede ir en el render). */
function avatarAlAzar(tiene: string[]): AvatarConfig {
  const r = <T,>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
  const col = (k: string) => r(COLORES[k])[0];
  return {
    cuerpo: Math.random() < 0.5 ? 'hombre' : 'mujer',
    piel: col('piel'),
    colorOjos: col('colorOjos'),
    pelo: r(['corto', 'largo', 'ninguno'] as const),
    colorPelo: col('colorPelo'),
    camisaTipo: r(partesDeArriba(tiene).map(([v]) => v)),
    camisa: col('camisa'),
    pantalonTipo: r(['jeans', 'falda'] as const),
    pantalon: col('pantalon'),
    zapatos: r(['tenis', 'zapatos'] as const),
    colorZapatos: col('colorZapatos'),
    lentes: tiene.includes('lentes') && Math.random() < 0.4 ? 'si' : 'no',
    audifonos: tiene.includes('audifonos') && Math.random() < 0.4 ? 'si' : 'no',
    colorAcc: col('colorAcc'),
    disfraz: Math.random() < 0.2 ? r(['ninguno', ...PRENDAS.filter((p) => p.slot === 'disfraz' && tiene.includes(p.id)).map((p) => p.val as Disfraz)]) : 'ninguno',
    colorDisfraz: col('colorDisfraz'),
  };
}

function Bloqueado({ texto, onPress }: { texto: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${texto}: consíguelo en la tienda`} style={styles.bloqueado}>
      <Candado />
      <Text style={styles.bloqueadoTxt}>{texto}</Text>
      <Text style={styles.link}>En la tienda</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.pantalla },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12 },
  titulo: { fontFamily: F.titulo, fontSize: 28, color: C.tinta },
  chipBtn: { height: 36, paddingHorizontal: 14, borderRadius: 999, backgroundColor: C.tarjeta, justifyContent: 'center' },
  chipTxt: { fontFamily: F.fuerte, fontSize: 13, color: C.texto },
  panel: { padding: 16, gap: 10 },
  input: { height: 48, borderRadius: 14, borderWidth: 2, borderColor: C.borde, backgroundColor: C.tarjeta, color: '#FFF', paddingHorizontal: 14, fontFamily: F.texto, fontSize: 16 },
  caja: { borderRadius: 14, backgroundColor: C.tarjeta, overflow: 'hidden' },
  bloqueado: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, borderRadius: 14, backgroundColor: C.tarjeta },
  bloqueadoTxt: { flex: 1, fontFamily: F.fuerte, fontSize: 15, color: C.apagado },
  link: { fontFamily: F.fuerte, fontSize: 14, color: C.amarillo },
});
