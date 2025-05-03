import { Pane } from "tweakpane";
import * as THREE from "three";
import { sandTexture, riverbedTexture } from './objects/ground';

export function setupUI({ waterResolution, water, ground, rockThrowController }) {
  const pane = new Pane();

  // Create UI folder for water parameters
  const waterFolder = pane.addFolder({ title: "Water" });

  if (water.simulationMaterial) {
    const simFolder = waterFolder.addFolder({ title: 'Simulation' });
    // Bind viscosity control
    simFolder.addBinding(water.simulationMaterial.uniforms.uViscosity, 'value', {
      min: 0, max: 0.3, step: 0.001, label: 'Viscosity'
    });
    // Bind disturbance amount control
    simFolder.addBinding(water.simulationMaterial.uniforms.uDisturbanceAmount, 'value', {
      min: 0.01, max: 0.6, step: 0.001, label: 'disturbance amount'
    });
    // Bind height scale control
    simFolder.addBinding(water.material.uniforms.uHeightScale, 'value', {
      min: 0, max: 1.0, step: 0.01, label: 'Height Scale'
    });
  }

  // Create UI folder for water color controls
  const colorFolder = waterFolder.addFolder({ title: "Color" });
  colorFolder.addBinding(water.material.uniforms.uOpacity, "value", {
    min: 0, max: 1, step: 0.01, label: "Opacity"
  });

  colorFolder.addBinding(water.material.uniforms.uTroughColor, "value", {
    label: "Trough Color", view: "color", color: { type: "float" }
  });

  colorFolder.addBinding(water.material.uniforms.uSurfaceColor, "value", {
    label: "Surface Color", view: "color", color: { type: "float" }
  });

  colorFolder.addBinding(water.material.uniforms.uCrestColor, "value", {
    label: "Peak Color", view: "color", color: { type: "float" }
  });

  colorFolder.addBinding(water.material.uniforms.uCrestThreshold, "value", {
    min: 0, max: 0.5, label: "Peak Threshold"
  });

  colorFolder.addBinding(water.material.uniforms.uCrestTransition, "value", {
    min: 0, max: 1, label: "Peak Transition"
  });

  // Create UI folder for Fresnel parameters
  const fresnelFolder = waterFolder.addFolder({ title: "Fresnel" });
  fresnelFolder.addBinding(water.material.uniforms.uFresnelStrength, "value", {
    min: 0, max: 1, label: "Scale"
  });
  fresnelFolder.addBinding(water.material.uniforms.uFresnelPower, "value", {
    min: 0, max: 3, label: "Power"
  });

  // Create UI folder for Caustics controls
  const causticsFolder = pane.addFolder({ title: "Caustics" });
  if (water.causticsMaterial) {
    causticsFolder.addBinding(water.causticsMaterial.uniforms.uWaterDepth, "value", {
      min: 0.1, max: 2.0, step: 0.01, label: "Water Depth"
    });
    causticsFolder.addBinding(water.causticsMaterial.uniforms.uIntensity, "value", {
      min: 0, max: 5, step: 0.1, label: "Light Intensity"
    });
  }
  if (ground.material) {
    causticsFolder.addBinding(ground.material.uniforms.uCausticsIntensity, "value", {
      min: 0, max: 1.0, step: 0.01, label: "Ground Intensity"
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

  // Create UI folder for ground parameters
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

    // Add repeat controls for ground texture
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

    // Add repeat controls for exterior ground texture
    exGroundFolder.addBinding(ground.exteriorMaterial.uniforms.uTextureRepeat.value, 'x', {
      min: 1, max: 20, step: 0.5, label: 'Repeat X'
    });
    exGroundFolder.addBinding(ground.exteriorMaterial.uniforms.uTextureRepeat.value, 'y', {
      min: 1, max: 20, step: 0.5, label: 'Repeat Y'
    });
  }

  if (rockThrowController) {
    const rockFolder = pane.addFolder({ title: "Rock Physics" });

    // Add skip angle threshold control
    rockFolder.addBinding(rockThrowController.rockOptions, 'skipAngleThreshold', {
      min: 0.0, max: 90.0, step: 1.0, label: 'Skip Angle (°)'
    }).on('change', () => {
        rockThrowController.updateAllRocksOptions();
    });

    // Other rock physics controls
    rockFolder.addBinding(rockThrowController.rockOptions, 'minSkipVelocity', {
      min: 0.2, max: 2.0, step: 0.1, label: 'Min Skip Velocity'
    }).on('change', () => {
        rockThrowController.updateAllRocksOptions();
    });

    rockFolder.addBinding(rockThrowController.rockOptions, 'elasticity', {
      min: 0.1, max: 0.9, step: 0.05, label: 'Bounce Factor'
    }).on('change', () => {
        rockThrowController.updateAllRocksOptions();
    });

    rockFolder.addBinding(rockThrowController.rockOptions, 'skipsBeforeSink', {
      min: 1, max: 10, step: 1, label: 'Max Skips'
    }).on('change', () => {
        rockThrowController.updateAllRocksOptions();
    });
  }
}