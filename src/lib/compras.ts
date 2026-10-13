// Compra de paquetes de monedas con dinero real (App Store / Google Play).
//
// Para producción se conecta una librería de compras dentro de la app (por ejemplo RevenueCat o
// expo-iap) y una función del servidor que valide el recibo y sume las monedas en `perfiles`.
// Mientras tanto: en modo local (pruebas) las monedas se suman directo; con cuenta se avisa.
import { useJugador } from '@/store/jugador';

export const comprasDisponibles = () => useJugador.getState().modo === 'local';

export async function comprarPaquete(monedas: number) {
  if (!comprasDisponibles()) {
    throw new Error('Las compras con App Store y Google Play se activan al publicar la app.');
  }
  useJugador.getState().sumarMonedas(monedas);
}
