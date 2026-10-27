// Холст с офисом на весь экран. Сцену запускает движок; React только создаёт холст.
import { useEffect, useRef } from 'react';
import { startScene } from '../model/engine';
import { bindSceneInput } from '../model/input';
import s from './OfficeScene.module.scss';

export function OfficeScene() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    startScene(cv);
    bindSceneInput(cv);
  }, []);
  return <canvas ref={ref} className={s.canvas} />;
}
