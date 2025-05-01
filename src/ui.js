import { Pane } from "tweakpane";
import * as THREE from "three";
// Import the ground textures
import { sandTexture, riverbedTexture } from './objects/ground';

export function setupUI({ waterResolution, water, ground }) {
  const pane = new Pane();

  // Water parameters folder
  const waterFolder = pane.addFolder({ title: "Water" });

  if (water.simulationMaterial) {
    const simFolder = waterFolder.addFolder({ title: 'Simulation' });
    simFolder.addBinding(water.simulationMaterial.uniforms.uViscosity, 'value', { min: 0, max: 0.1, step: 0.001, label: 'Viscosity' });
    simFolder.addBinding(water.simulationMaterial.uniforms.uDisturbanceAmount, 'value', { min: 0, max: 0.1, step: 0.001, label: 'disturbance amount' });
    simFolder.addBinding(water.simulationMaterial.uniforms.uDisturbanceAmount, 'value', { min: 0.001, max: 0.1, step: 0.001, label: 'ripple radius' });
    simFolder.addBinding(water.material.uniforms.uHeightScale, 'value', { min: 0, max: 1.0, step: 0.01, label: 'Height Scale' });
  } else {
    console.warn("Water object does not have simulationMaterial for UI setup.");
  }

  // Color
  const colorFolder = waterFolder.addFolder({ title: "Color" });

  colorFolder.addBinding(water.material.uniforms.uOpacity, "value", {
    min: 0,
    max: 1,
    step: 0.01,
    label: "Opacity",
  });

  colorFolder.addBinding(water.material.uniforms.uTroughColor, "value", {
    label: "Trough Color",
    view: "color",
    color: { type: "float" },
  });
  colorFolder.addBinding(water.material.uniforms.uSurfaceColor, "value", {
    label: "Surface Color",
    view: "color",
    color: { type: "float" },
  });
  colorFolder.addBinding(water.material.uniforms.uCrestColor, "value", {
    label: "Peak Color",
    view: "color",
    color: { type: "float" },
  });
  colorFolder.addBinding(water.material.uniforms.uCrestThreshold, "value", {
    min: 0,
    max: 0.5,
    label: "Peak Threshold",
  });
  colorFolder.addBinding(water.material.uniforms.uCrestTransition, "value", {
    min: 0,
    max: 0.5,
    label: "Peak Transition",
  });
  colorFolder.addBinding(water.material.uniforms.uTroughThreshold, "value", {
    min: -0.5,
    max: 0,
    label: "Trough Threshold",
  });
  colorFolder.addBinding(water.material.uniforms.uTroughTransition, "value", {
    min: 0,
    max: 0.5,
    label: "Trough Transition",
  });

  // Fresnel
  const fresnelFolder = waterFolder.addFolder({ title: "Fresnel" });
  fresnelFolder.addBinding(water.material.uniforms.uFresnelStrength, "value", {
    min: 0,
    max: 1,
    label: "Scale",
  });
  fresnelFolder.addBinding(water.material.uniforms.uFresnelPower, "value", {
    min: 0,
    max: 3,
    label: "Power",
  });

  // Add Caustics controls (using water and ground uniforms)
  const causticsFolder = pane.addFolder({ title: "Caustics" });
  if (water.causticsMaterial) {
    causticsFolder.addBinding(water.causticsMaterial.uniforms.uWaterDepth, "value", {
      min: 0.1,
      max: 2.0,
      step: 0.01,
      label: "Water Depth",
    });
    causticsFolder.addBinding(water.causticsMaterial.uniforms.uIntensity, "value", {
      min: 0,
      max: 5,
      step: 0.1,
      label: "Light Intensity",
    });
  }
  if (ground.material) {
    causticsFolder.addBinding(ground.material.uniforms.uCausticsIntensity, "value", {
      min: 0,
      max: 1.0,
      step: 0.01,
      label: "Ground Intensity",
    });
  }

  // Helper object to map texture names to texture objects
  const textureMap = {
    Riverbed: riverbedTexture,
    Sand: sandTexture,
  };

  // Intermediate state for Tweakpane texture selection
  const uiState = {
    groundTexture: 'Riverbed', // Default value
    exGroundTexture: 'Riverbed', // Default value
  };

  // Ground parameters folder
  const groundFolder = pane.addFolder({ title: "Ground" });
  if (ground.material) {
    // Bind to the intermediate string state
    groundFolder.addBinding(uiState, 'groundTexture', {
      label: 'Texture',
      options: {
        Riverbed: 'Riverbed',
        Sand: 'Sand',
      }
    }).on('change', ({ value }) => {
      // Update the actual uniform when the selection changes
      ground.material.uniforms.uTexture.value = textureMap[value];
    });

    groundFolder.addBinding(ground.material.uniforms.uTextureRepeat.value, 'x', {
      min: 1, max: 20, step: 0.5, label: 'Repeat X'
    });
    groundFolder.addBinding(ground.material.uniforms.uTextureRepeat.value, 'y', {
      min: 1, max: 20, step: 0.5, label: 'Repeat Y'
    });
  }

  // Exterior Ground parameters folder
  const exGroundFolder = pane.addFolder({ title: "Exterior Ground" });
  if (ground.exteriorMaterial) {
    // Bind to the intermediate string state
    exGroundFolder.addBinding(uiState, 'exGroundTexture', {
      label: 'Texture',
      options: {
        Riverbed: 'Riverbed',
        Sand: 'Sand',
      }
    }).on('change', ({ value }) => {
      // Update the actual uniform when the selection changes
      ground.exteriorMaterial.uniforms.uTexture.value = textureMap[value];
    });

    exGroundFolder.addBinding(ground.exteriorMaterial.uniforms.uTextureRepeat.value, 'x', {
      min: 1, max: 20, step: 0.5, label: 'Repeat X'
    });
    exGroundFolder.addBinding(ground.exteriorMaterial.uniforms.uTextureRepeat.value, 'y', {
      min: 1, max: 20, step: 0.5, label: 'Repeat Y'
    });
  }
}