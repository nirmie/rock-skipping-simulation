varying vec2 vUv;
varying vec3 vPosition;
varying vec3 vNormal;

void main() {
  vUv = uv;
  vec4 worldPos = modelMatrix * vec4(position, 1.0);
  vPosition = worldPos.xyz;

// get normal matrix 
  vNormal = normalize(mat3(modelMatrix) * normal); 

  
  gl_Position = projectionMatrix * viewMatrix * worldPos;
}