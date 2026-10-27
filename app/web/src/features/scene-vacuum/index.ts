// Робот-пылесос: регистрируется в реестре сценок при загрузке модуля (blocks: false — другим сценкам не мешает).
// В кадре по глубине: drawVacuum — на vacuumDepthY() (null — стоит на базе), drawDock — на DOCK_DEPTH_Y.
export { vacuumNow, vacuumDepthY, vacuumStep, DOCK, type Vacuum } from './model/vacuum';
export { drawVacuum, drawDock, DOCK_DEPTH_Y } from './ui/drawVacuum';
