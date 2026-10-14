// Tienda: tocar una prenda te la prueba en tu avatar al instante; si ya es tuya, se queda puesta.
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar3D } from '@/avatar/Avatar3D';
import type { AvatarAnim } from '@/avatar/types';
import { articulo, conPrenda, llevaPuesta, PAQUETES, PASOS, PRENDAS, type Articulo } from '@/data/catalogo';
import { IMAGEN_ARTICULO } from '@/data/imagenes';
import { comprarPaquete } from '@/lib/compras';
import { useJugador } from '@/store/jugador';
import { Aviso, Boton, Pestanas } from '@/ui/comunes';
import { Moneda } from '@/ui/iconos';
import { C, ETIQUETA_COLOR, F, fmt } from '@/ui/tema';

type Tab = 'ropa' | 'paso';

export default function Tienda() {
  const params = useLocalSearchParams<{ sel?: string }>();
  const { avatar, setAvatar, monedas, tiene, comprar } = useJugador();
  const [sel, setSel] = useState<string>(() => (params.sel && articulo(params.sel) ? params.sel : 'dino'));
  const [tab, setTab] = useState<Tab>(() => articulo(params.sel ?? '')?.tipo ?? 'ropa');
  // si llegan aquí desde Mis pasos con otro artículo, se selecciona (ajuste durante el render, sin efecto)
  const [selParam, setSelParam] = useState(params.sel);
  if (params.sel !== selParam) {
    setSelParam(params.sel);
    const a = params.sel ? articulo(params.sel) : undefined;
    if (a) {
      setSel(a.id);
      setTab(a.tipo);
    }
  }
  const [hoja, setHoja] = useState<'' | 'confirmar' | 'monedas'>('');
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [bailando, setBailando] = useState(false);


  const item = articulo(sel) ?? PRENDAS[0];
  const esPaso = item.tipo === 'paso';
  const mio = tiene.includes(item.id);
  const puesta = item.tipo === 'ropa' && llevaPuesta(avatar, item);
  // tu avatar con la prenda elegida puesta (para ver cómo te queda antes de comprar)
  const vista = item.tipo === 'ropa' ? conPrenda(avatar, item) : avatar;
  const anim: AvatarAnim = esPaso ? (item.id as AvatarAnim) : bailando ? 'caminar' : 'idle';

  const tocar = (a: Articulo) => {
    setSel(a.id);
    setError('');
    // si ya es tuya, se pone al tocarla; si no, solo te la pruebas
    if (a.tipo === 'ropa' && tiene.includes(a.id) && !llevaPuesta(avatar, a)) setAvatar(conPrenda(avatar, a));
  };

  const comprarAhora = async () => {
    setOcupado(true);
    setError('');
    try {
      await comprar(item.id);
      if (item.tipo === 'ropa') setAvatar(conPrenda(useJugador.getState().avatar, item));
      setHoja('');
      setAviso(esPaso ? `¡Paso ${item.nombre} desbloqueado! Ponlo en tu rueda desde Mis pasos` : `¡${item.nombre} es tuyo y ya lo llevas puesto!`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOcupado(false);
    }
  };

  let etiqueta: string = item.etiqueta;
  let colorEtq = ETIQUETA_COLOR[item.etiqueta];
  if (puesta) etiqueta = 'Lo llevas puesto';
  else if (!esPaso && !mio) etiqueta = `Probándotelo · ${item.etiqueta}`;
  else if (mio && item.precio > 0) etiqueta = 'Tuyo';
  if (puesta || mio) colorEtq = C.turquesa;

  let cta: React.ReactNode = null;
  if (esPaso && mio) cta = <Boton tipo="ok" titulo="Ponerlo en mi rueda" onPress={() => router.push('/pasos')} />;
  else if (!esPaso && puesta && item.quitar)
    cta = (
      <Boton
        tipo="ok"
        titulo={item.id === 'dino' ? 'Quitármelo' : 'Quitármelos'}
        onPress={() => {
          setAvatar({ ...avatar, [item.slot]: item.quitar });
          setAviso(`${item.nombre} guardado`);
        }}
      />
    );
  else if (!mio)
    cta = (
      <Boton onPress={() => setHoja('confirmar')}>
        <Text style={styles.ctaTxt}>Comprar</Text>
        <Moneda size={20} />
        <Text style={styles.ctaTxt}>{fmt(item.precio)}</Text>
      </Boton>
    );

  const lista: Articulo[] = tab === 'ropa' ? PRENDAS : PASOS;
  const alcanza = monedas >= item.precio;

  return (
    <SafeAreaView style={styles.pantalla} edges={['top']}>
      <Aviso texto={aviso} onFin={() => setAviso('')} />
      <View style={styles.cabeza}>
        <Text style={styles.titulo}>Tienda</Text>
        <Pressable onPress={() => setHoja('monedas')} style={styles.monedas} accessibilityLabel="Conseguir monedas">
          <Moneda />
          <Text style={styles.monedasTxt}>{fmt(monedas)}</Text>
          <Text style={[styles.monedasTxt, { color: C.amarillo }]}>+</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, gap: 12 }}>
        <View style={styles.hero}>
          <Avatar3D avatares={[{ config: vista, anim }]} encuadre={!esPaso && item.tipo === 'ropa' && item.busto ? 'busto' : 'cuerpo'} style={{ width: 130, height: 160 }} sombras={false} />
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={[styles.etq, { color: colorEtq }]}>{etiqueta}</Text>
            <Text style={styles.nombre}>{item.nombre}</Text>
            <Text style={styles.texto}>{item.desc}</Text>
            {!esPaso && (
              <Pressable onPress={() => setBailando(!bailando)} style={styles.chipBtn}>
                <Text style={styles.chipTxt}>{bailando ? 'Verlo parado' : 'Verlo bailando'}</Text>
              </Pressable>
            )}
          </View>
        </View>
        {cta}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pestanas<Tab> items={[['ropa', 'Ropa y accesorios'], ['paso', 'Pasos de baile']]} valor={tab} onCambio={(t) => { setTab(t); setSel(t === 'ropa' ? 'dino' : 'disco'); }} />
        <View style={styles.rejilla}>
          {lista.map((a) => {
            const tuyo = tiene.includes(a.id);
            const on = a.tipo === 'ropa' && llevaPuesta(avatar, a);
            return (
              <Pressable key={a.id} onPress={() => tocar(a)} style={[styles.carta, { borderColor: sel === a.id ? C.amarillo : 'transparent' }]} accessibilityLabel={`${a.nombre}${tuyo ? ', tuyo' : `, ${a.precio} monedas`}`}>
                <Image source={IMAGEN_ARTICULO[a.id]} style={styles.imagen} contentFit="contain" />
                <Text style={styles.cartaNombre} numberOfLines={1}>
                  {a.nombre}
                </Text>
                {on ? (
                  <Text style={[styles.marca, { backgroundColor: C.turquesa, color: C.fondo }]}>Puesto</Text>
                ) : tuyo ? (
                  <Text style={[styles.marca, { color: C.turquesa }]}>{a.precio === 0 ? 'Gratis' : 'Tuyo'}</Text>
                ) : (
                  <View style={[styles.marcaFila]}>
                    <Moneda size={12} />
                    <Text style={[styles.marca, { color: '#FFF', paddingHorizontal: 0 }]}>{fmt(a.precio)}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          {/* huecos invisibles para completar la última fila: así las tarjetas no se separan */}
          {Array.from({ length: (3 - (lista.length % 3)) % 3 }, (_, i) => (
            <View key={`hueco${i}`} style={styles.hueco} />
          ))}
        </View>
        <Text style={styles.nota}>
          {tab === 'ropa'
            ? 'Toca una prenda y te la pruebas al instante. Si ya es tuya, se queda puesta. Los colores se cambian gratis en el creador.'
            : 'Tus 4 pasos favoritos van en la rueda del juego (los eliges en Mis pasos). Cada paso que bailas mientras suena la música suma +5 puntos.'}
        </Text>
      </ScrollView>

      <Modal visible={hoja !== ''} transparent animationType="slide" onRequestClose={() => setHoja('')}>
        <Pressable style={styles.velo} onPress={() => setHoja('')} accessibilityLabel="Cerrar" />
        <View style={styles.hoja}>
          <View style={styles.asa} />
          {hoja === 'confirmar' ? (
            <>
              <Text style={styles.hojaTitulo}>¿Comprar {item.nombre}?</Text>
              <Text style={styles.texto}>{alcanza ? `${fmt(item.precio)} monedas · te quedan ${fmt(monedas - item.precio)}` : `Cuesta ${fmt(item.precio)} · tienes ${fmt(monedas)}`}</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {alcanza ? (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Boton tipo="secundario" titulo="Cancelar" onPress={() => setHoja('')} style={{ flex: 1 }} />
                  <Boton titulo={ocupado ? '…' : 'Comprar'} deshabilitado={ocupado} onPress={comprarAhora} style={{ flex: 1.4 }} />
                </View>
              ) : (
                <>
                  <Text style={styles.error}>Te faltan {fmt(item.precio - monedas)} monedas</Text>
                  <Boton titulo="Conseguir monedas" onPress={() => setHoja('monedas')} />
                </>
              )}
            </>
          ) : (
            <>
              <Text style={styles.hojaTitulo}>Conseguir monedas</Text>
              <Text style={styles.texto}>También ganas monedas jugando: 1 por cada 10 puntos.</Text>
              {PAQUETES.map((p) => (
                <View key={p.id} style={styles.paquete}>
                  <Moneda size={34} />
                  <Text style={[styles.cartaNombre, { flex: 1, fontSize: 18 }]}>{fmt(p.monedas)} monedas</Text>
                  <Boton
                    tipo="ok"
                    titulo="Comprar"
                    style={{ height: 44, minWidth: 96 }}
                    onPress={() =>
                      comprarPaquete(p.monedas)
                        .then(() => {
                          setAviso(`+${fmt(p.monedas)} monedas`);
                          setHoja(articulo(sel) && !tiene.includes(sel) ? 'confirmar' : '');
                        })
                        .catch((e) => setError((e as Error).message))
                    }
                  />
                </View>
              ))}
              {error ? <Text style={styles.error}>{error}</Text> : null}
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: C.pantalla },
  cabeza: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  titulo: { fontFamily: F.titulo, fontSize: 28, color: C.tinta },
  monedas: { height: 40, paddingLeft: 8, paddingRight: 12, borderRadius: 999, borderWidth: 2, borderColor: C.borde, backgroundColor: C.tarjeta, flexDirection: 'row', alignItems: 'center', gap: 6 },
  monedasTxt: { fontFamily: F.fuerte, fontSize: 15, color: '#FFF' },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.tarjeta, borderRadius: 20, padding: 8 },
  etq: { fontFamily: F.fuerte, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  nombre: { fontFamily: F.titulo, fontSize: 28, lineHeight: 38, color: C.texto },
  texto: { fontFamily: F.texto, fontSize: 13, lineHeight: 18, color: C.texto2 },
  chipBtn: { alignSelf: 'flex-start', height: 32, paddingHorizontal: 12, borderRadius: 999, backgroundColor: C.tarjeta2, justifyContent: 'center' },
  chipTxt: { fontFamily: F.fuerte, fontSize: 12, color: C.texto },
  ctaTxt: { fontFamily: F.titulo, fontSize: 22, color: C.fondo },
  error: { padding: 10, borderRadius: 12, backgroundColor: C.errorFondo, color: C.errorTexto, fontFamily: F.fuerte, fontSize: 14 },
  rejilla: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10 },
  // 3 por fila de borde a borde; ancho fijo para que la última fila no se estire
  carta: { width: '32%', borderRadius: 16, borderWidth: 3, backgroundColor: C.tarjeta, alignItems: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 4 },
  imagen: { width: '100%', height: 92 },
  hueco: { width: '32%' },
  cartaNombre: { fontFamily: F.fuerte, fontSize: 14, color: C.texto },
  marca: { fontFamily: F.fuerte, fontSize: 11, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden', backgroundColor: C.tarjeta2 },
  marcaFila: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: C.tarjeta2 },
  nota: { fontFamily: F.texto, fontSize: 12, color: C.tinta2, textAlign: 'center' },
  velo: { flex: 1, backgroundColor: 'rgba(8,12,24,0.6)' },
  hoja: { backgroundColor: C.tarjeta, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36, gap: 12 },
  asa: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.fondo },
  hojaTitulo: { fontFamily: F.titulo, fontSize: 22, color: C.texto },
  paquete: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 16, backgroundColor: C.fondo },
});
