/**
 * Orbit camera driven by pointer events (mouse, pen and touch).
 *
 * The camera orbits a target point. Its state is (yaw, pitch, distance); with yaw = 0 and
 * pitch = 0 it looks along +z, which is the official Cornell box view.
 */

import { add, cross, normalize, scale, sub, length } from '../math/math.js';

const MAX_PITCH = (85 * Math.PI) / 180;
const ROTATE_SPEED = 0.005; // radians per CSS pixel
const ZOOM_SPEED = 0.0015; // per wheel delta unit
const INTERACTION_GRACE_MS = 150;

/** Orbit angles that reproduce a camera placed at `position` looking at `target`. */
export function anglesFromCamera(position, target) {
  const offset = sub(target, position); // from the camera to the target
  const distance = length(offset);
  return {
    yaw: Math.atan2(offset[0], offset[2]),
    pitch: Math.asin(Math.max(-1, Math.min(1, offset[1] / distance))),
    distance,
  };
}

/** Camera position and orthonormal basis for the given orbit state. */
export function cameraFrame({ target, yaw, pitch, distance, worldUp = [0, 1, 0] }) {
  const forward = [
    Math.cos(pitch) * Math.sin(yaw),
    Math.sin(pitch),
    Math.cos(pitch) * Math.cos(yaw),
  ];
  const position = sub(target, scale(forward, distance));
  const right = normalize(cross(forward, worldUp));
  const up = cross(right, forward);
  return { position, forward, right, up };
}

/**
 * Direction of the primary ray through normalized image coordinates `uv` ∈ [0, 1]²
 * (same formula as `cameraRay` in common.glsl).
 */
export function primaryRayDirection(frame, uv, fovYDegrees, aspect) {
  const tanHalfFov = Math.tan((fovYDegrees * Math.PI) / 360);
  const x = (uv[0] * 2 - 1) * aspect * tanHalfFov;
  const y = (uv[1] * 2 - 1) * tanHalfFov;
  return normalize(add(add(frame.forward, scale(frame.right, x)), scale(frame.up, y)));
}

/**
 * tan(fovY / 2) actually used for an image of the given aspect ratio. The official view is
 * square; on portrait screens the horizontal field of view is kept instead, so the whole box
 * stays visible. Shared by the shader uniforms, the ray inspector and the projection below.
 */
export function viewTanHalfFov(fovYDegrees, aspect) {
  return Math.tan((fovYDegrees * Math.PI) / 360) / Math.min(aspect, 1);
}

/**
 * Projects a world point to normalized image coordinates (x, y in [-1, 1], y up). `depth` is
 * the distance along the view direction; points with depth ≤ 0 are behind the camera.
 */
export function projectPoint(frame, tanHalfFov, aspect, point) {
  const p = [
    point[0] - frame.position[0],
    point[1] - frame.position[1],
    point[2] - frame.position[2],
  ];
  const depth = p[0] * frame.forward[0] + p[1] * frame.forward[1] + p[2] * frame.forward[2];
  const x = p[0] * frame.right[0] + p[1] * frame.right[1] + p[2] * frame.right[2];
  const y = p[0] * frame.up[0] + p[1] * frame.up[1] + p[2] * frame.up[2];
  return { x: x / (depth * aspect * tanHalfFov), y: y / (depth * tanHalfFov), depth };
}

export class OrbitCamera {
  /**
   * @param {HTMLElement} element  element that receives the pointer events
   * @param {{position: number[], target: number[], fovY: number}} home  official camera
   * @param {(event: {interacting: boolean}) => void} onChange
   */
  constructor(element, home, onChange) {
    this.element = element;
    this.onChange = onChange;
    this.pointers = new Map();
    this.pinchDistance = 0;
    this.wheelTimer = 0;
    this.setHome(home);

    this.handlers = {
      pointerdown: (e) => this.onPointerDown(e),
      pointermove: (e) => this.onPointerMove(e),
      pointerup: (e) => this.onPointerUp(e),
      pointercancel: (e) => this.onPointerUp(e),
      wheel: (e) => this.onWheel(e),
    };
    for (const [type, handler] of Object.entries(this.handlers)) {
      element.addEventListener(type, handler, type === 'wheel' ? { passive: false } : undefined);
    }
    element.style.touchAction = 'none';
  }

  /** Sets the official camera for a scene and moves there. */
  setHome(home) {
    this.home = home;
    this.fovY = home.fovY;
    this.reset();
  }

  /** Back to the official camera. */
  reset() {
    this.target = [...this.home.target];
    const angles = anglesFromCamera(this.home.position, this.home.target);
    this.yaw = angles.yaw;
    this.pitch = angles.pitch;
    this.distance = angles.distance;
    this.homeDistance = angles.distance;
    this.emit();
  }

  get interacting() {
    return this.pointers.size > 0 || this.wheelTimer !== 0;
  }

  frame() {
    return cameraFrame({
      target: this.target,
      yaw: this.yaw,
      pitch: this.pitch,
      distance: this.distance,
    });
  }

  emit() {
    this.onChange?.({ interacting: this.interacting });
  }

  onPointerDown(e) {
    try {
      this.element.setPointerCapture(e.pointerId); // keep receiving moves outside the canvas
    } catch {
      // Synthetic or already released pointers cannot be captured; dragging still works.
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) this.pinchDistance = this.currentPinchDistance();
    this.emit();
  }

  onPointerMove(e) {
    const previous = this.pointers.get(e.pointerId);
    if (!previous) return;
    const current = { x: e.clientX, y: e.clientY };
    this.pointers.set(e.pointerId, current);

    if (this.pointers.size === 1) {
      // "Grab the box": the box turns in the direction of the drag.
      this.yaw -= (current.x - previous.x) * ROTATE_SPEED;
      this.pitch -= (current.y - previous.y) * ROTATE_SPEED;
      this.pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, this.pitch));
    } else if (this.pointers.size === 2) {
      const pinch = this.currentPinchDistance();
      if (this.pinchDistance > 0) this.zoomBy(this.pinchDistance / pinch);
      this.pinchDistance = pinch;
    }
    this.emit();
  }

  onPointerUp(e) {
    if (!this.pointers.delete(e.pointerId)) return;
    this.pinchDistance = this.pointers.size === 2 ? this.currentPinchDistance() : 0;
    this.emit();
  }

  onWheel(e) {
    e.preventDefault();
    this.zoomBy(Math.exp(e.deltaY * ZOOM_SPEED));
    clearTimeout(this.wheelTimer);
    this.wheelTimer = setTimeout(() => {
      this.wheelTimer = 0;
      this.emit();
    }, INTERACTION_GRACE_MS);
    this.emit();
  }

  zoomBy(factor) {
    const min = this.homeDistance * 0.3;
    const max = this.homeDistance * 2.5;
    this.distance = Math.max(min, Math.min(max, this.distance * factor));
  }

  currentPinchDistance() {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  dispose() {
    clearTimeout(this.wheelTimer);
    for (const [type, handler] of Object.entries(this.handlers)) {
      this.element.removeEventListener(type, handler);
    }
  }
}
