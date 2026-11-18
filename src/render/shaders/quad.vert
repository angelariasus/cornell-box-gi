// Full-screen triangle generated from gl_VertexID (no vertex buffers needed).
// Vertices (-1,-1), (3,-1), (-1,3) cover the whole viewport.

void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
