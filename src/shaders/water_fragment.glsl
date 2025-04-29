precision highp float;

uniform samplerCube uEnvironementMap;

uniform vec3 uTroughColor;
uniform vec3 uSurfaceColor;
uniform vec3 uCrestColor;

uniform float uTroughThreshold;
uniform float uTroughTransition;
uniform float uCrestThreshold;
uniform float uCrestTransition;
uniform float uOpacity;

uniform float uFresnelStrength;
uniform float uFresnelPower;

varying vec3 vWorldPosition;
varying vec3 vNormal;

void main() {
  vec3 viewDirection = normalize(vWorldPosition - cameraPosition);
  vec3 reflected = reflect(viewDirection, vNormal);
  // reflected.x *= -1.0;

  vec3 reflectionColor = textureCube(uEnvironementMap, reflected).rgb;

  float fresnel =
      pow(1.0 - clamp(dot(viewDirection, vNormal), 0.0, 1.0), uFresnelPower) *
      uFresnelStrength;

  float trough2surface =
      smoothstep(uTroughThreshold - uTroughTransition,
                 uTroughThreshold + uTroughTransition, vWorldPosition.y);
  float surface2crest =
      smoothstep(uCrestThreshold - uCrestTransition,
                 uCrestThreshold + uCrestTransition, vWorldPosition.y);

  vec3 mixedColor = mix(uTroughColor, uSurfaceColor, trough2surface);
  vec3 mixedColor2 = mix(mixedColor, uCrestColor, surface2crest);
  vec3 finalColor = mix(mixedColor2, reflectionColor, fresnel);
  gl_FragColor = vec4(finalColor, uOpacity);
}