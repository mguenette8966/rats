/* Grace & the Three Rats - Browser 3D Game (Babylon.js)
   Controls:
   - WASD / Arrow keys: Move
   - Mouse drag: Rotate camera
   - E: Interact (pick up nearby rat)
*/

(async function() {
  const canvas = document.getElementById('renderCanvas');
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.65, 0.82, 0.97, 1.0);
  scene.collisionsEnabled = true;
  scene.gravity = new BABYLON.Vector3(0, -0.5, 0);

  const camera = new BABYLON.ArcRotateCamera('camera', Math.PI, BABYLON.Angle.FromDegrees(45).radians(), 12, new BABYLON.Vector3(0, 1.2, 0), scene);
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 20;
  camera.lowerBetaLimit = BABYLON.Angle.FromDegrees(10).radians();
  camera.upperBetaLimit = BABYLON.Angle.FromDegrees(80).radians();
  camera.attachControl(canvas, true);

  const light = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.85;
  const dirLight = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.3, -1, -0.2), scene);
  dirLight.position = new BABYLON.Vector3(60, 80, 40);
  dirLight.intensity = 0.6;

  // GUI Overlay
  const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('ui');

  function showToast(message, durationMs = 2000) {
    const rect = new BABYLON.GUI.Rectangle();
    rect.thickness = 0;
    rect.background = '#000000aa';
    rect.cornerRadius = 8;
    rect.height = '50px';
    rect.width = '40%';
    rect.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
    rect.top = '20px';

    const text = new BABYLON.GUI.TextBlock();
    text.text = message;
    text.color = 'white';
    text.fontSize = 20;
    rect.addControl(text);
    ui.addControl(rect);

    setTimeout(() => ui.removeControl(rect), durationMs);
  }

  function createLabelForMesh(mesh, label, color = 'white') {
    const rect = new BABYLON.GUI.Rectangle();
    rect.background = '#00000088';
    rect.color = color;
    rect.thickness = 1;
    rect.cornerRadius = 6;
    rect.height = '24px';
    rect.width = '140px';
    rect.isVisible = false;

    const text = new BABYLON.GUI.TextBlock();
    text.text = label;
    text.color = 'white';
    text.fontSize = 16;
    rect.addControl(text);

    ui.addControl(rect);
    rect.linkWithMesh(mesh);
    rect.linkOffsetY = -30; // above mesh

    return rect;
  }

  // Ground & Roads
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 200, height: 200, subdivisions: 2 }, scene);
  const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.55, 0.75, 0.45); // grass-green
  ground.material = groundMat;
  ground.checkCollisions = true;

  function createRoad(x, z, width, length, rotationY = 0) {
    const road = BABYLON.MeshBuilder.CreateGround('road', { width, height: length }, scene);
    road.position = new BABYLON.Vector3(x, 0.01, z);
    road.rotation.y = rotationY;
    const mat = new BABYLON.StandardMaterial('roadMat' + Math.random(), scene);
    mat.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.18);
    road.material = mat;
    return road;
  }

  // Simple grid roads
  const roadSegments = [];
  for (let i = -60; i <= 60; i += 30) {
    roadSegments.push(createRoad(i, 0, 8, 200)); // vertical
    roadSegments.push(createRoad(0, i, 200, 8)); // horizontal
  }

  // Buildings
  const buildings = [];
  const labelsForSpecial = {};

  function createBuilding(name, x, z, w, d, h, color) {
    const box = BABYLON.MeshBuilder.CreateBox(name, { width: w, depth: d, height: h }, scene);
    box.position = new BABYLON.Vector3(x, h / 2, z);
    box.checkCollisions = true;

    const mat = new BABYLON.StandardMaterial('mat_' + name, scene);
    mat.diffuseColor = color;
    box.material = mat;

    buildings.push(box);
    addBuildingDetails(box);
    return box;
  }

  // Building details: windows, doors, and simple roof
  function addBuildingDetails(building) {
    const ext = building.getBoundingInfo().boundingBox.extendSize;
    const basePos = building.position;
    const h = ext.y * 2;

    // Door (front, +Z side)
    const door = BABYLON.MeshBuilder.CreatePlane('door_' + building.name, { width: Math.min(1.2, ext.x * 1.6), height: 1.8 }, scene);
    door.position = new BABYLON.Vector3(basePos.x, 0.9, basePos.z + ext.z + 0.02);
    const doorMat = new BABYLON.StandardMaterial('doorMat_' + building.name, scene);
    doorMat.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0.1);
    door.material = doorMat;

    // Windows (left/right and back)
    function makeWindow(px, py, pz, ry) {
      const win = BABYLON.MeshBuilder.CreatePlane('win_' + Math.random(), { width: 0.9, height: 0.9 }, scene);
      win.position = new BABYLON.Vector3(px, py, pz);
      win.rotation.y = ry;
      const wm = new BABYLON.StandardMaterial('winMat_' + Math.random(), scene);
      wm.diffuseColor = new BABYLON.Color3(0.6, 0.8, 1.0);
      wm.emissiveColor = new BABYLON.Color3(0.2, 0.3, 0.5);
      win.material = wm;
      return win;
    }
    const winY = Math.min(1.4, h * 0.6);
    // Left/right
    makeWindow(basePos.x - ext.x - 0.02, winY, basePos.z - ext.z * 0.3, Math.PI / 2);
    makeWindow(basePos.x - ext.x - 0.02, winY, basePos.z + ext.z * 0.3, Math.PI / 2);
    makeWindow(basePos.x + ext.x + 0.02, winY, basePos.z - ext.z * 0.3, -Math.PI / 2);
    makeWindow(basePos.x + ext.x + 0.02, winY, basePos.z + ext.z * 0.3, -Math.PI / 2);
    // Back
    makeWindow(basePos.x - ext.x * 0.3, winY, basePos.z - ext.z - 0.02, Math.PI);
    makeWindow(basePos.x + ext.x * 0.3, winY, basePos.z - ext.z - 0.02, Math.PI);

    // Roof (simple slab)
    const roof = BABYLON.MeshBuilder.CreateBox('roof_' + building.name, { width: ext.x * 2 + 0.6, depth: ext.z * 2 + 0.6, height: 0.4 }, scene);
    roof.position = new BABYLON.Vector3(basePos.x, basePos.y + ext.y + 0.2, basePos.z);
    const roofMat = new BABYLON.StandardMaterial('roofMat_' + building.name, scene);
    roofMat.diffuseColor = new BABYLON.Color3(0.5, 0.1, 0.1);
    roof.material = roofMat;

    // Landscaping: trees and bushes
    addTreesAndBushesAround(building);
  }

  function addTreesAndBushesAround(building) {
    const ext = building.getBoundingInfo().boundingBox.extendSize;
    const basePos = building.position;

    function createTree(pos) {
      const trunk = BABYLON.MeshBuilder.CreateCylinder('trunk_' + Math.random(), { height: 1.6, diameter: 0.18 }, scene);
      trunk.position = pos.add(new BABYLON.Vector3(0, 0.8, 0));
      const trunkMat = new BABYLON.StandardMaterial('trunkMat_' + Math.random(), scene);
      trunkMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.12);
      trunk.material = trunkMat;

      const crown = BABYLON.MeshBuilder.CreateSphere('crown_' + Math.random(), { diameter: 1.2 }, scene);
      crown.position = pos.add(new BABYLON.Vector3(0, 1.6, 0));
      const crownMat = new BABYLON.StandardMaterial('crownMat_' + Math.random(), scene);
      crownMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.2);
      crown.material = crownMat;
    }

    function createBush(pos) {
      const bush = BABYLON.MeshBuilder.CreateSphere('bush_' + Math.random(), { diameter: 0.6 }, scene);
      bush.position = pos.add(new BABYLON.Vector3(0, 0.3, 0));
      const bushMat = new BABYLON.StandardMaterial('bushMat_' + Math.random(), scene);
      bushMat.diffuseColor = new BABYLON.Color3(0.25, 0.7, 0.25);
      bush.material = bushMat;
    }

    const offsets = [
      new BABYLON.Vector3(ext.x + 1.5, 0, ext.z + 0.5),
      new BABYLON.Vector3(-ext.x - 1.5, 0, ext.z + 0.5),
      new BABYLON.Vector3(ext.x + 1.5, 0, -ext.z - 0.5),
      new BABYLON.Vector3(-ext.x - 1.5, 0, -ext.z - 0.5),
    ];
    offsets.forEach((o, i) => {
      const world = basePos.add(o);
      if (i % 2 === 0) createTree(world); else createBush(world);
    });
  }

  // Place a small town around origin avoiding the roads near the center lines
  const townDescriptors = [
    { name: 'School', color: new BABYLON.Color3(0.2, 0.5, 0.9) },
    { name: 'Hospital', color: new BABYLON.Color3(0.9, 0.2, 0.2) },
    { name: 'Grocery', color: new BABYLON.Color3(0.2, 0.8, 0.3) },
  ];

  const rand = (min, max) => Math.random() * (max - min) + min;

  const usedSlots = new Set();
  function snapToGrid(v, grid = 15) { return Math.round(v / grid) * grid; }
  function isNearRoad(x, z) {
    // avoid road center lines roughly +/-6 units
    return (Math.abs(x) < 10 || Math.abs(z) < 10) || (Math.abs((x % 30)) < 6) || (Math.abs((z % 30)) < 6);
  }

  function placeBuildings() {
    // Several generic houses
    for (let i = 0; i < 30; i++) {
      let x, z;
      let tries = 0;
      do {
        x = snapToGrid(rand(-80, 80));
        z = snapToGrid(rand(-80, 80));
        tries++;
      } while ((isNearRoad(x, z) || usedSlots.has(x + ',' + z)) && tries < 50);
      usedSlots.add(x + ',' + z);
      const w = rand(8, 14);
      const d = rand(8, 14);
      const h = rand(6, 12);
      const house = createBuilding('House_' + i, x, z, w, d, h, new BABYLON.Color3(0.7, 0.6, 0.5));
    }

    // Special buildings
    townDescriptors.forEach((t, idx) => {
      let x, z;
      let tries = 0;
      do {
        x = snapToGrid(rand(-70, 70));
        z = snapToGrid(rand(-70, 70));
        tries++;
      } while ((isNearRoad(x, z) || usedSlots.has(x + ',' + z)) && tries < 50);
      usedSlots.add(x + ',' + z);
      const b = createBuilding(t.name, x, z, 18, 18, 12, t.color);
      labelsForSpecial[t.name] = createFloatingBillboard(t.name, b, t.name);
    });
  }

  function createFloatingBillboard(id, mesh, text) {
    const plane = BABYLON.MeshBuilder.CreatePlane('sign_' + id, { size: 8 }, scene);
    plane.position = mesh.position.add(new BABYLON.Vector3(0, mesh.scaling.y + mesh.getBoundingInfo().boundingBox.extendSize.y + 6, 0));
    plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
    const mat = new BABYLON.StandardMaterial('signMat_' + id, scene);
    mat.diffuseColor = new BABYLON.Color3(1, 1, 1);
    mat.emissiveColor = new BABYLON.Color3(1, 1, 1);

    const dynTex = new BABYLON.DynamicTexture('dynTex_' + id, { width: 512, height: 256 }, scene, false);
    dynTex.hasAlpha = true;
    const ctx = dynTex.getContext();
    ctx.clearRect(0, 0, 512, 256);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 64px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 128);
    dynTex.update();

    mat.diffuseTexture = dynTex;
    plane.material = mat;
    plane.isPickable = false;
    return plane;
  }

  placeBuildings();

  // Home selection: pick one house to be home
  const homeCandidates = buildings.filter(b => b.name.startsWith('House_'));
  const home = homeCandidates.length ? homeCandidates[Math.floor(Math.random() * homeCandidates.length)] : buildings[0];
  const homeMarker = createFloatingBillboard('HOME', home, 'Home');
  homeMarker.isVisible = false;

  // Player (Grace)
  const grace = BABYLON.MeshBuilder.CreateCapsule('GraceBody', { height: 2.0, radius: 0.45 }, scene);
  grace.position = new BABYLON.Vector3(0, 1.1, 0);
  grace.checkCollisions = true;
  grace.ellipsoid = new BABYLON.Vector3(0.45, 1.0, 0.45);
  grace.ellipsoidOffset = new BABYLON.Vector3(0, 1.0, 0);
  const graceMat = new BABYLON.StandardMaterial('graceMat', scene);
  graceMat.diffuseColor = new BABYLON.Color3(0.9, 0.75, 0.6);
  grace.material = graceMat;

  // Head + Hair adjusted so torso is above ground
  const head = BABYLON.MeshBuilder.CreateSphere('GraceHead', { diameter: 0.6 }, scene);
  head.position = new BABYLON.Vector3(0, 2.1, 0);
  head.parent = grace;
  const hair = BABYLON.MeshBuilder.CreateSphere('GraceHair', { diameter: 0.9 }, scene);
  hair.position = new BABYLON.Vector3(0, 2.35, 0);
  hair.parent = grace;
  const hairMat = new BABYLON.StandardMaterial('hairMat', scene);
  hairMat.diffuseColor = new BABYLON.Color3(0.36, 0.22, 0.12);
  hair.material = hairMat;

  // Limbs (simple cylinders) + walk animation pivots
  const limbMat = new BABYLON.StandardMaterial('limbMat', scene);
  limbMat.diffuseColor = new BABYLON.Color3(0.85, 0.7, 0.6);
  function createLimb(name, height, diameter) {
    const limb = BABYLON.MeshBuilder.CreateCylinder(name, { height, diameter }, scene);
    limb.parent = grace;
    limb.setPivotPoint(new BABYLON.Vector3(0, height / 2, 0)); // rotate from top
    limb.material = limbMat;
    return limb;
  }
  const leftLeg = createLimb('LeftLeg', 1.0, 0.18); leftLeg.position = new BABYLON.Vector3(-0.25, 0.5, 0);
  const rightLeg = createLimb('RightLeg', 1.0, 0.18); rightLeg.position = new BABYLON.Vector3(0.25, 0.5, 0);
  const leftArm = createLimb('LeftArm', 0.9, 0.14); leftArm.position = new BABYLON.Vector3(-0.55, 1.5, 0.1);
  const rightArm = createLimb('RightArm', 0.9, 0.14); rightArm.position = new BABYLON.Vector3(0.55, 1.5, 0.1);

  // Camera follows Grace
  camera.lockedTarget = grace;

  // Inverted mouse controls for yaw/tilt while keeping camera behind Grace
  let graceYaw = 0;
  const mouseSensitivity = 0.003;
  const tiltSensitivity = 0.003;
  let lastMouseX = null;
  canvas.addEventListener('mousemove', (e) => {
    const dx = (typeof e.movementX === 'number') ? e.movementX : (lastMouseX == null ? 0 : e.clientX - lastMouseX);
    lastMouseX = e.clientX;
    graceYaw += dx * mouseSensitivity; // inverted left/right
    camera.alpha = -graceYaw - Math.PI / 2; // keep camera behind grace
    camera.beta -= (e.movementY || 0) * tiltSensitivity; // inverted up/down
    if (camera.beta < camera.lowerBetaLimit) camera.beta = camera.lowerBetaLimit;
    if (camera.beta > camera.upperBetaLimit) camera.beta = camera.upperBetaLimit;
  });
  canvas.addEventListener('mouseleave', () => { lastMouseX = null; });

  // Player movement
  const input = { f: false, b: false, l: false, r: false };
  function setKey(key, down) {
    switch (key) {
      case 'w': case 'ArrowUp': input.f = down; break;
      case 's': case 'ArrowDown': input.b = down; break;
      case 'a': case 'ArrowLeft': input.l = down; break;
      case 'd': case 'ArrowRight': input.r = down; break;
    }
  }
  window.addEventListener('keydown', (e) => setKey(e.key, true));
  window.addEventListener('keyup', (e) => setKey(e.key, false));

  const moveSpeed = 0.12;
  const step = new BABYLON.Vector3();
  let walkPhase = 0; // for animating limbs
  scene.onBeforeRenderObservable.add(() => {
    // Determine forward direction relative to camera's Y-only orientation
    const dt = engine.getDeltaTime() / 16.67; // scale to ~60fps baseline
    const forward = new BABYLON.Vector3(Math.sin(graceYaw), 0, Math.cos(graceYaw));
    const right = new BABYLON.Vector3(Math.cos(graceYaw), 0, -Math.sin(graceYaw));

    step.copyFromFloats(0, 0, 0);
    if (input.f) step.addInPlace(forward);
    if (input.b) step.addInPlace(forward.scale(-1));
    if (input.l) step.addInPlace(right.scale(-1));
    if (input.r) step.addInPlace(right);

    const isMoving = step.lengthSquared() > 0.0001;
    if (isMoving) {
      step.normalize().scaleInPlace(moveSpeed * dt);
      const targetY = Math.atan2(step.x, step.z);
      grace.rotation.y = targetY; // face movement direction
    }

    const moveVector = new BABYLON.Vector3(step.x, scene.gravity.y * 0.5, step.z);
    grace.moveWithCollisions(moveVector);

    // Limb walk animation
    const targetPhaseSpeed = (isMoving ? 0.35 : 0);
    walkPhase += targetPhaseSpeed * dt * 60; // scale for frame rate
    const swing = isMoving ? Math.sin(walkPhase) * 0.6 : 0;
    const swingOpp = -swing;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = swingOpp;
    leftArm.rotation.x = swingOpp * 0.7;
    rightArm.rotation.x = swing * 0.7;
  });

  // Rats
  function createRat(id, colorScheme) {
    const root = new BABYLON.TransformNode('rat_' + id, scene);

    // Body
    const body = BABYLON.MeshBuilder.CreateCapsule('ratBody_' + id, { height: 0.45, radius: 0.12 }, scene);
    body.parent = root;
    body.rotation = new BABYLON.Vector3(0, 0, 0);

    // Head
    const head = BABYLON.MeshBuilder.CreateSphere('ratHead_' + id, { diameter: 0.17 }, scene);
    head.parent = root;
    head.position = new BABYLON.Vector3(0, 0.18, 0.18);

    // Ears
    const earL = BABYLON.MeshBuilder.CreateSphere('ratEarL_' + id, { diameter: 0.07 }, scene);
    earL.parent = head; earL.position = new BABYLON.Vector3(-0.07, 0.08, -0.02);
    const earR = earL.clone('ratEarR_' + id);
    earR.parent = head; earR.position = new BABYLON.Vector3(0.07, 0.08, -0.02);

    // Tail
    const tail = BABYLON.MeshBuilder.CreateCylinder('ratTail_' + id, { height: 0.35, diameter: 0.03 }, scene);
    tail.parent = root;
    tail.rotation.x = Math.PI / 2;
    tail.position = new BABYLON.Vector3(0, 0.05, -0.27);

    // Materials
    const matBody = new BABYLON.StandardMaterial('matRatBody_' + id, scene);
    const matHead = new BABYLON.StandardMaterial('matRatHead_' + id, scene);
    const matEar = new BABYLON.StandardMaterial('matRatEar_' + id, scene);
    const matTail = new BABYLON.StandardMaterial('matRatTail_' + id, scene);

    if (colorScheme === 'brown') {
      matBody.diffuseColor = new BABYLON.Color3(0.45, 0.3, 0.18);
      matHead.diffuseColor = new BABYLON.Color3(0.45, 0.3, 0.18);
    } else if (colorScheme === 'blackwhiteA') {
      matBody.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
      matHead.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
    } else if (colorScheme === 'blackwhiteB') {
      matBody.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
      matHead.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    }
    matEar.diffuseColor = new BABYLON.Color3(0.95, 0.7, 0.75);
    matTail.diffuseColor = new BABYLON.Color3(0.95, 0.7, 0.75);

    body.material = matBody;
    head.material = matHead;
    earL.material = matEar;
    earR.material = matEar;
    tail.material = matTail;

    // Shadow receive (optional): disabled for performance

    // Collider proxy for proximity detection
    const proxy = BABYLON.MeshBuilder.CreateSphere('ratProxy_' + id, { diameter: 0.6 }, scene);
    proxy.position = BABYLON.Vector3.Zero();
    proxy.isVisible = false;
    proxy.isPickable = false;
    proxy.parent = root;

    return { root, proxy };
  }

  const rats = [
    { name: 'Rio', scheme: 'brown', attach: new BABYLON.Vector3(0, 2.2, 0), hint: 'Rio is on your head!' },
    { name: 'Chunk', scheme: 'blackwhiteA', attach: new BABYLON.Vector3(-0.5, 1.6, 0.2), hint: 'Chunk is on your left shoulder!' },
    { name: 'Snickerdoodle', scheme: 'blackwhiteB', attach: new BABYLON.Vector3(0.5, 1.6, 0.2), hint: 'Snickerdoodle is on your right shoulder!' },
  ];

  const ratEntities = rats.map(r => {
    const m = createRat(r.name, r.scheme);
    m.root.metadata = { ratName: r.name, found: false };
    m.proxy.metadata = m.root.metadata;
    m.root.scaling = new BABYLON.Vector3(1.2, 1.2, 1.2);
    const label = createLabelForMesh(m.root, r.name);
    return { ...r, ...m, label };
  });

  // Candidate spawn points near buildings but accessible
  const spawnPoints = [];
  buildings.forEach(b => {
    const ext = b.getBoundingInfo().boundingBox.extendSize;
    const pos = b.position;
    const offsets = [
      new BABYLON.Vector3(ext.x + 1.2, 0, 0),
      new BABYLON.Vector3(-ext.x - 1.2, 0, 0),
      new BABYLON.Vector3(0, 0, ext.z + 1.2),
      new BABYLON.Vector3(0, 0, -ext.z - 1.2),
    ];
    offsets.forEach(o => spawnPoints.push(pos.add(o)));
  });

  function randomSpawn(exclusions = []) {
    for (let tries = 0; tries < 100; tries++) {
      const p = spawnPoints[Math.floor(Math.random() * spawnPoints.length)];
      if (!p) break;
      let ok = true;
      for (const e of exclusions) {
        if (BABYLON.Vector3.Distance(e, p) < 3) { ok = false; break; }
      }
      if (ok) return p.clone();
    }
    return new BABYLON.Vector3(rand(-50, 50), 0, rand(-50, 50));
  }

  const placed = [];
  ratEntities.forEach((r, idx) => {
    const p = randomSpawn(placed);
    placed.push(p);
    r.root.position = new BABYLON.Vector3(p.x, 0.15, p.z);
  });

  // Proximity & interaction
  const revealDistance = 4.0;
  const interactDistance = 2.0;

  function updateRatLabels() {
    for (const r of ratEntities) {
      if (r.root.metadata.found) { r.label.isVisible = false; continue; }
      const d = BABYLON.Vector3.Distance(r.root.position, grace.position);
      r.label.isVisible = d < revealDistance;
    }
  }

  scene.onBeforeRenderObservable.add(updateRatLabels);

  let allFound = false;

  function attachRatToGrace(rat) {
    rat.root.setParent(grace);
    rat.root.position = rat.attach.clone();
    rat.root.rotation = new BABYLON.Vector3(0, 0, 0);
    rat.root.metadata.found = true;
    rat.label.isVisible = false;
  }

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'e' && e.key !== 'E') return;
    for (const r of ratEntities) {
      if (r.root.metadata.found) continue;
      const d = BABYLON.Vector3.Distance(r.root.position, grace.position);
      if (d < interactDistance) {
        attachRatToGrace(r);
        showToast(`You found ${r.name}! ${r.hint}`, 2500);
      }
    }

    if (!allFound && ratEntities.every(r => r.root.metadata.found)) {
      allFound = true;
      showToast('All rats found! Return home to win!', 3000);
      homeMarker.isVisible = true;
    }
  });

  // Win condition detection
  const winDistance = 3.0;
  let gameWon = false;
  scene.onBeforeRenderObservable.add(() => {
    if (!allFound || gameWon) return;
    const d = BABYLON.Vector3.Distance(grace.position, home.position);
    if (d < winDistance) {
      gameWon = true;
      showToast('You made it home with all three rats! You win! 🎉', 5000);
    }
  });

  // Resize
  window.addEventListener('resize', () => engine.resize());

  engine.runRenderLoop(() => {
    scene.render();
  });
})();