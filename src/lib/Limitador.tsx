// Limita los cuadros por segundo de un <Canvas> con frameloop="demand": pide un cuadro cada 1/fps segundos.
// A 30 cuadros la GPU hace la mitad del trabajo que a 60 (la pantalla es grande y el render va a la
// resolución nativa del teléfono), y los bailes se siguen viendo fluidos.
import { useThree } from '@react-three/fiber/native';
import React, { useEffect } from 'react';

type Props = {
  fps?: number;
  /** Mientras `quieto()` devuelva true no se dibuja nada (se revisa en cada tic). Es una ref: no reinicia el intervalo. */
  pausa?: React.RefObject<{ quieto(ahora: number): boolean }>;
};

export function Limitador({ fps = 30, pausa }: Props) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    const t = setInterval(() => {
      if (!pausa?.current?.quieto(performance.now())) invalidate();
    }, 1000 / fps);
    return () => clearInterval(t);
  }, [invalidate, fps, pausa]);
  return null;
}
