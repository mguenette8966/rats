/* Grace & the Three Rats - Browser 3D Game (Babylon.js)
   Controls:
   - WASD / Arrow keys: Move
   - Mouse drag: Rotate camera
   - E: Interact (pick up nearby rat)
*/

(async function() {
  const canvas = document.getElementById('renderCanvas');
  const engine = new BABYLON.Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true, disableWebGL2Support: false });
  canvas.setAttribute('tabindex', '1');

  const scene = new BABYLON.Scene(engine);
  scene.clearColor = new BABYLON.Color4(0.65, 0.82, 0.97, 1.0);
  scene.collisionsEnabled = true;
  scene.gravity = new BABYLON.Vector3(0, -0.5, 0);

  let gameStarted = false;

  const camera = new BABYLON.ArcRotateCamera('camera', Math.PI, BABYLON.Angle.FromDegrees(45).radians(), 12, new BABYLON.Vector3(0, 1.2, 0), scene);
  camera.lowerRadiusLimit = 8;
  camera.upperRadiusLimit = 20;
  camera.lowerBetaLimit = BABYLON.Angle.FromDegrees(10).radians();
  camera.upperBetaLimit = BABYLON.Angle.FromDegrees(80).radians();
  // Attach camera control only after a game starts
  function attachCameraIfNeeded(){ if (gameStarted && !camera._attachedByCode) { camera.attachControl(canvas, true); camera._attachedByCode = true; } }
  camera.panningSensibility = 0;

  const light = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.85;
  const dirLight = new BABYLON.DirectionalLight('sun', new BABYLON.Vector3(-0.3, -1, -0.2), scene);
  dirLight.position = new BABYLON.Vector3(60, 80, 40);
  dirLight.intensity = 0.6;

  // GUI Overlay
  const ui = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI('UI');
  ui.layer.layerMask = 0x0FFFFFFF; ui.rootContainer.zIndex = 3000;
  let currentMode = 'MENU';
  const HNSRoot = new BABYLON.TransformNode('HNSRoot', scene);
  HNSRoot.setEnabled(false);

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

  function createTitleScreen() {
    const overlay = new BABYLON.GUI.Rectangle('titleOverlay');
    overlay.width = 1; overlay.height = 1; overlay.background = '#000000ff'; overlay.thickness = 0;
    overlay.zIndex = 10000;
    overlay.isPointerBlocker = true;
    overlay.clipChildren = false;
    overlay.clipContent = false;
    ui.addControl(overlay);

    const stack = new BABYLON.GUI.StackPanel();
    stack.isVertical = true;
    stack.width = '95%';
    stack.height = '100%';
    stack.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
    stack.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    overlay.addControl(stack);

    const title = new BABYLON.GUI.TextBlock();
    title.text = 'Hide and Squeak';
    title.color = 'white';
    title.fontSize = 70;
    title.paddingTop = '0px';
    title.textWrapping = true;
    title.resizeToFit = true;
    title.zIndex = 10001;
    stack.addControl(title);

    const art = new BABYLON.GUI.TextBlock();
    art.text = '🐭 Rio    🐭 Chunk    🐭 Snickerdoodle\n🌸 🌼 🌺   Find all 3 and bring them home!';
    art.color = 'white';
    art.fontSize = 32;
    art.width = '95%';
    art.textWrapping = true;
    art.resizeToFit = true;
    art.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
    art.paddingTop = '24px';
    art.zIndex = 10001;
    stack.addControl(art);

    // Audio setup helpers
    let audioCtx = null;
    function ensureAudio() {
      if (!audioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) audioCtx = new Ctx();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume?.();
      }
      return audioCtx;
    }
    // Expose to outer scope for footsteps
    function getFootBuffer() {
      const ctx = ensureAudio();
      if (!ctx) return null;
      if (window.__hs_audio && window.__hs_audio.footBuffer) return window.__hs_audio.footBuffer;
      const duration = 0.15;
      const sampleRate = ctx.sampleRate;
      const length = Math.floor(duration * sampleRate);
      const buffer = ctx.createBuffer(1, length, sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) {
        // white noise thump with exponential decay
        const t = i / sampleRate;
        const env = Math.exp(-t * 40); // fast decay
        data[i] = (Math.random() * 2 - 1) * env;
      }
      if (!window.__hs_audio) window.__hs_audio = {};
      window.__hs_audio.footBuffer = buffer;
      return buffer;
    }
    window.__hs_audio = { ensureAudio: ensureAudio, getFootBuffer: getFootBuffer };

    function showInstructionScreen(onDone) {
      const instr = new BABYLON.GUI.Rectangle('instructionOverlay');
      instr.width = 1; instr.height = 1; instr.background = '#000000ff'; instr.thickness = 0;
      instr.zIndex = 11000; instr.isPointerBlocker = true; instr.clipChildren = false; instr.clipContent = false;
      ui.addControl(instr);

      const txt = new BABYLON.GUI.TextBlock('instructionText');
      txt.text = 'Rio, Chunk, and Snickers have gone out to play.\nGo find them all and bring them back home!';
      txt.color = 'white'; txt.fontSize = 42; txt.textWrapping = true; txt.resizeToFit = true; txt.width = '90%';
      txt.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
      txt.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      instr.addControl(txt);

      let timeoutId = setTimeout(() => { ui.removeControl(instr); onDone && onDone(); }, 5000);
      instr.onPointerUpObservable.add(() => {
        if (timeoutId) clearTimeout(timeoutId);
        ensureAudio();
        ui.removeControl(instr); onDone && onDone();
      });
    }

    const startBtn = BABYLON.GUI.Button.CreateSimpleButton('startGameBtn', 'Start Game');
    startBtn.width = '300px';
    startBtn.height = '90px';
    startBtn.color = 'white';
    startBtn.background = '#2b7a2b';
    startBtn.fontSize = 32;
    startBtn.cornerRadius = 12;
    startBtn.paddingTop = '40px';
    startBtn.zIndex = 10001;
    startBtn.onPointerUpObservable.add(() => {
      ensureAudio();
      ui.removeControl(overlay);
      showInstructionScreen(() => { if (currentMode==='HNS') hud.isVisible = true; gameStarted = true; attachCameraIfNeeded(); canvas.focus(); });
    });
    stack.addControl(startBtn);
  }

  function createLabelForMesh(mesh, label, color = 'white') {
    const rect = new BABYLON.GUI.Rectangle();
    rect.background = '#00000088';
    rect.color = color;
    rect.thickness = 1;
    rect.cornerRadius = 6;
    rect.height = '24px';
    rect.width = '180px';
    rect.isVisible = false;

    const text = new BABYLON.GUI.TextBlock();
    text.text = label;
    text.color = 'white';
    text.fontSize = 16;
    rect.addControl(text);

    ui.addControl(rect);
    rect.linkWithMesh(mesh);
    rect.linkOffsetY = -30; // above mesh
    rect.metadata = rect.metadata || {};
    rect.metadata.textControl = text;

    return rect;
  }

  // Build master game select (game starts paused)
  function createGameSelectScreen() {
    currentMode = 'MENU';
    gameStarted = false;
    const overlay = new BABYLON.GUI.Rectangle('gameSelectOverlay');
    overlay.width = 1; overlay.height = 1; overlay.background = '#1a1a1add'; overlay.thickness = 0; overlay.zIndex = 20000; overlay.isPointerBlocker = true;
    ui.addControl(overlay);

    const stack = new BABYLON.GUI.StackPanel(); stack.isVertical = true; stack.width = '80%'; stack.height = '100%'; stack.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER; overlay.addControl(stack);

    const title = new BABYLON.GUI.TextBlock(); title.text = 'Select Your Game'; title.color = 'white'; title.fontSize = 64; title.paddingBottom = '30px'; stack.addControl(title);

    const subtitle = new BABYLON.GUI.TextBlock(); subtitle.text = 'Choose an adventure to begin'; subtitle.color = '#ddd'; subtitle.fontSize = 24; subtitle.paddingBottom = '40px'; stack.addControl(subtitle);

    function makeBtn(text, bg){ const b = BABYLON.GUI.Button.CreateSimpleButton('btn_'+text, text); b.width = '340px'; b.height = '80px'; b.color = 'white'; b.background = bg; b.fontSize = 28; b.cornerRadius = 12; b.paddingBottom = '20px'; return b; }

    const btnHNS = makeBtn('Hide and Squeak', '#2b7a2b');
    btnHNS.onPointerUpObservable.add(() => { currentMode = 'HNS'; HNSRoot.setEnabled(true); ui.removeControl(overlay); createTitleScreen(); });
    stack.addControl(btnHNS);

    const btnUntitled = makeBtn('Untitled Game', '#1f5f99');
    btnUntitled.onPointerUpObservable.add(() => { currentMode = 'CAGE'; HNSRoot.setEnabled(false); ui.removeControl(overlay); startCageLevel(); });
    stack.addControl(btnUntitled);
  }

  function startCageLevel() {
    // Hide H&S HUD if present
    try { if (hud) hud.isVisible = false; } catch(e){}
    // Place cage far from town
    const root = new BABYLON.TransformNode('CageRoot', scene);
    const base = new BABYLON.Vector3(300, 0, 0);
    root.position = base.clone();

    const levelSize = 50; // quarter of 200
    const levelHeight = 5;
    const floorThickness = 0.5;
    const cageWallHeight = levelHeight*2 + levelHeight; // space above top equal to distance between levels

    const blackMat = new BABYLON.StandardMaterial('cageBlack', scene); blackMat.diffuseColor = new BABYLON.Color3(0,0,0);

    // Bottom floor
    const floor1 = BABYLON.MeshBuilder.CreateBox('CageFloor1', { width: levelSize, depth: levelSize, height: floorThickness }, scene);
    floor1.position = base.add(new BABYLON.Vector3(0, floorThickness/2, 0)); floor1.material = blackMat; floor1.checkCollisions = true; floor1.parent = root;

    // Top floor split with opening in middle (gapWidth)
    const gapWidth = 10;
    const half = (levelSize - gapWidth)/2;
    const y2 = levelHeight + floorThickness/2;
    const floor2A = BABYLON.MeshBuilder.CreateBox('CageFloor2A', { width: half, depth: levelSize, height: floorThickness }, scene);
    floor2A.position = base.add(new BABYLON.Vector3(-(gapWidth/2 + half/2), y2, 0)); floor2A.material = blackMat; floor2A.checkCollisions = true; floor2A.parent = root;
    const floor2B = BABYLON.MeshBuilder.CreateBox('CageFloor2B', { width: half, depth: levelSize, height: floorThickness }, scene);
    floor2B.position = base.add(new BABYLON.Vector3( (gapWidth/2 + half/2), y2, 0)); floor2B.material = blackMat; floor2B.checkCollisions = true; floor2B.parent = root;

    // Ramp from floor1 up to floor2A edge
    const rampLen = levelHeight * 2.2; const rampHeight = 0.5; const rampWidth = 6;
    const ramp = BABYLON.MeshBuilder.CreateBox('CageRamp', { width: rampWidth, depth: rampLen, height: rampHeight }, scene);
    ramp.material = blackMat; ramp.checkCollisions = true; ramp.parent = root;
    ramp.rotation.x = -Math.atan2(levelHeight, rampLen);
    // Position ramp so bottom rests on floor1 and top meets floor2A edge
    const rampCenterY = floorThickness/2 + (levelHeight/2);
    ramp.position = base.add(new BABYLON.Vector3(-levelSize*0.2, rampCenterY, -levelSize*0.15));
    // Align ramp end to floor2A: shift forward towards center
    ramp.position.z += rampLen*0.25;

    // Cage bars around perimeter
    const barMat = new BABYLON.StandardMaterial('barMat', scene); barMat.diffuseColor = new BABYLON.Color3(0.15,0.15,0.15);
    const barSpacing = 2.5; const barRadius = 0.1; const barH = cageWallHeight;
    function addBar(x,z){ const c = BABYLON.MeshBuilder.CreateCylinder('CageBar',{height:barH, diameter: barRadius*2}, scene); c.material = barMat; c.position = base.add(new BABYLON.Vector3(x, barH/2, z)); c.checkCollisions = true; c.parent = root; }
    for (let x = -levelSize/2; x <= levelSize/2; x += barSpacing) { addBar(x, -levelSize/2); addBar(x, levelSize/2); }
    for (let z = -levelSize/2; z <= levelSize/2; z += barSpacing) { addBar(-levelSize/2, z); addBar(levelSize/2, z); }
    // Roof bars
    const roofY = cageWallHeight;
    for (let x = -levelSize/2; x <= levelSize/2; x += barSpacing) {
      const rb = BABYLON.MeshBuilder.CreateCylinder('CageRoofBar', { height: levelSize, diameter: barRadius*2 }, scene);
      rb.rotation.z = Math.PI/2; rb.material = barMat; rb.position = base.add(new BABYLON.Vector3(x, roofY, 0)); rb.checkCollisions = true; rb.parent = root;
    }

    // Move Grace into cage and start
    graceCollider.position = base.add(new BABYLON.Vector3(0, 1.1, levelSize*0.2));
    camera.setTarget(graceCollider);
    gameStarted = true; attachCameraIfNeeded();
  }

  // Show game selection on launch
  createGameSelectScreen();

  // Ground & Roads
  const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 200, height: 200, subdivisions: 2 }, scene);
  const groundMat = new BABYLON.StandardMaterial('groundMat', scene);
  groundMat.diffuseColor = new BABYLON.Color3(0.55, 0.75, 0.45); // grass-green
  ground.material = groundMat;
  ground.checkCollisions = true;
  ground.parent = HNSRoot;

  function createRoad(x, z, width, length, rotationY = 0) {
    const road = BABYLON.MeshBuilder.CreateGround('road', { width, height: length }, scene);
    road.position = new BABYLON.Vector3(x, 0.01, z);
    road.rotation.y = rotationY;
    const mat = new BABYLON.StandardMaterial('roadMat' + Math.random(), scene);
    mat.diffuseColor = new BABYLON.Color3(0.18, 0.18, 0.18);
    road.material = mat;
    road.parent = HNSRoot;
    return road;
  }

  // Perimeter fence to prevent falling off
  function createFence() {
    const thickness = 0.5; const height = 3; const halfW = 100; const halfH = 100;
    const fenceMat = new BABYLON.StandardMaterial('fenceMat', scene);
    fenceMat.diffuseColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    const north = BABYLON.MeshBuilder.CreateBox('fenceN', { width: 200, height, depth: thickness }, scene);
    north.position = new BABYLON.Vector3(0, height / 2, -halfH + thickness / 2);
    const south = north.clone('fenceS'); south.position = new BABYLON.Vector3(0, height / 2, halfH - thickness / 2);
    const west = BABYLON.MeshBuilder.CreateBox('fenceW', { width: thickness, height, depth: 200 }, scene);
    west.position = new BABYLON.Vector3(-halfW + thickness / 2, height / 2, 0);
    const east = west.clone('fenceE'); east.position = new BABYLON.Vector3(halfW - thickness / 2, height / 2, 0);
    ;[north, south, west, east].forEach(w => { w.material = fenceMat; w.checkCollisions = true; w.parent = HNSRoot; });
  }
  createFence();

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
    box.parent = HNSRoot;

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
    const door = BABYLON.MeshBuilder.CreatePlane('door_' + building.name, { width: Math.min(1.2, ext.x * 1.6), height: 1.8, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    door.position = new BABYLON.Vector3(basePos.x, 0.9, basePos.z + ext.z + 0.03);
    const doorMat = new BABYLON.StandardMaterial('doorMat_' + building.name, scene);
    doorMat.diffuseColor = new BABYLON.Color3(0.4, 0.2, 0.1);
    doorMat.backFaceCulling = false;
    door.material = doorMat;
    building.metadata = building.metadata || {};
    building.metadata.door = door;

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
      trunk.position = new BABYLON.Vector3(pos.x, 0.8, pos.z);
      const trunkMat = new BABYLON.StandardMaterial('trunkMat_' + Math.random(), scene);
      trunkMat.diffuseColor = new BABYLON.Color3(0.4, 0.25, 0.12);
      trunk.material = trunkMat;

      const crown = BABYLON.MeshBuilder.CreateSphere('crown_' + Math.random(), { diameter: 1.2 }, scene);
      crown.position = new BABYLON.Vector3(pos.x, 1.6, pos.z);
      const crownMat = new BABYLON.StandardMaterial('crownMat_' + Math.random(), scene);
      crownMat.diffuseColor = new BABYLON.Color3(0.2, 0.6, 0.2);
      crown.material = crownMat;
    }

    function createBush(pos) {
      const bush = BABYLON.MeshBuilder.CreateSphere('bush_' + Math.random(), { diameter: 0.6 }, scene);
      bush.position = new BABYLON.Vector3(pos.x, 0.3, pos.z);
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
      const world = new BABYLON.Vector3(basePos.x + o.x, 0, basePos.z + o.z);
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
  try { homeMarker.parent = HNSRoot; } catch(e){}

  // Add "Grace's House" sign above home door if available
  if (home && home.metadata && home.metadata.door) {
    const d = home.metadata.door.position;
    const sign = BABYLON.MeshBuilder.CreatePlane('homeDoorSign', { width: 3, height: 0.8, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    sign.position = new BABYLON.Vector3(d.x, d.y + 0.95, d.z + 0.02);
    sign.rotation.y = Math.PI; // face outward toward -Z
    const sm = new BABYLON.StandardMaterial('homeDoorSignMat', scene);
    const sTex = new BABYLON.DynamicTexture('homeDoorSignTex', { width: 512, height: 128 }, scene, false);
    sTex.drawText("Grace's House", 20, 90, 'bold 64px sans-serif', 'white', 'rgba(0,0,0,0.6)', true);
    sm.diffuseTexture = sTex; sm.backFaceCulling = false; sign.material = sm;
  }

  // Make Grace's house colorful and covered with big flowers so it's obvious
  (function decorateHome(building) {
    if (!building) return;
    const ext = building.getBoundingInfo().boundingBox.extendSize;
    const pos = building.position;

    // Bright, playful color for the house
    const brightMat = new BABYLON.StandardMaterial('homeBrightMat', scene);
    brightMat.diffuseColor = new BABYLON.Color3(0.85, 0.35, 0.85);
    brightMat.emissiveColor = new BABYLON.Color3(0.2, 0.05, 0.2);
    building.material = brightMat;

    // Palette for flowers
    const flowerColors = [
      new BABYLON.Color3(1.0, 0.3, 0.5),
      new BABYLON.Color3(1.0, 0.8, 0.2),
      new BABYLON.Color3(0.3, 0.9, 0.6),
      new BABYLON.Color3(0.4, 0.6, 1.0),
      new BABYLON.Color3(1.0, 0.5, 0.2),
    ];

    function makeFlower(x, y, z) {
      const f = BABYLON.MeshBuilder.CreateSphere('homeFlower_' + Math.random(), { diameter: 0.28 }, scene);
      f.position = new BABYLON.Vector3(x, y, z);
      const fm = new BABYLON.StandardMaterial('homeFlowerMat_' + Math.random(), scene);
      fm.diffuseColor = flowerColors[Math.floor(Math.random() * flowerColors.length)];
      fm.emissiveColor = fm.diffuseColor.scale(0.25);
      f.material = fm;
      return f;
    }

    // Exclusion box for sign area on front wall
    const signMinX = pos.x - 1.6, signMaxX = pos.x + 1.6;
    const signMinY = 1.4, signMaxY = 2.2;
    const frontZ = pos.z + ext.z + 0.06;

    // Front wall flowers (big grid) - avoid sign region
    for (let i = -3; i <= 3; i++) {
      for (let j = 0; j <= 3; j++) {
        const fx = pos.x + i * 0.6;
        const fy = 0.9 + j * 0.35;
        const fz = frontZ;
        const inSign = (fx >= signMinX && fx <= signMaxX && fy >= signMinY && fy <= signMaxY);
        if (!inSign) makeFlower(fx, fy, fz);
      }
    }

    // Side walls
    for (let i = -3; i <= 3; i++) {
      makeFlower(pos.x - ext.x - 0.06, 1.0 + Math.random() * 1.0, pos.z + i * 0.5);
      makeFlower(pos.x + ext.x + 0.06, 1.0 + Math.random() * 1.0, pos.z + i * 0.5);
    }

    // A few on the roof edge for extra visibility
    for (let i = -2; i <= 2; i++) {
      makeFlower(pos.x + i * 0.7, pos.y + ext.y + 0.25, pos.z + ext.z - 0.05);
    }

    // Ground flowers in front
    for (let i = -4; i <= 4; i++) {
      makeFlower(pos.x + i * 0.5, 0.08, pos.z + ext.z + 0.7);
    }
  })(home);

  // Player (Grace) – use a hidden collider and a visual rig to ensure torso height
  const graceCollider = BABYLON.MeshBuilder.CreateCapsule('GraceCollider', { height: 2.0, radius: 0.45 }, scene);
  graceCollider.position = new BABYLON.Vector3(0, 1.1, 0);
  graceCollider.checkCollisions = true;
  graceCollider.ellipsoid = new BABYLON.Vector3(0.45, 1.0, 0.45);
  graceCollider.ellipsoidOffset = new BABYLON.Vector3(0, 1.0, 0);
  graceCollider.isVisible = false;
  graceCollider.parent = HNSRoot;

  const graceVisual = new BABYLON.TransformNode('GraceVisual', scene);
  graceVisual.parent = graceCollider;

  // Torso
  const torso = BABYLON.MeshBuilder.CreateCapsule('GraceTorso', { height: 1.4, radius: 0.35 }, scene);
  torso.parent = graceVisual;
  torso.position = new BABYLON.Vector3(0, 1.2, 0);
  const graceMat = new BABYLON.StandardMaterial('graceMat', scene);
  graceMat.diffuseColor = new BABYLON.Color3(0.9, 0.75, 0.6);
  torso.material = graceMat;

  // Head + Hair
  const head = BABYLON.MeshBuilder.CreateSphere('GraceHead', { diameter: 0.6 }, scene);
  head.parent = graceVisual; head.position = new BABYLON.Vector3(0, 2.21, 0);
  const headMat = new BABYLON.StandardMaterial('headMat', scene);
  headMat.diffuseColor = new BABYLON.Color3(0.93, 0.80, 0.70); // light tan face
  headMat.specularColor = new BABYLON.Color3(0, 0, 0);
  headMat.emissiveColor = new BABYLON.Color3(0.15, 0.12, 0.10);
  head.material = headMat;

  const hair = BABYLON.MeshBuilder.CreateSphere('GraceHair', { diameter: 0.8 }, scene);
  hair.parent = graceVisual; hair.position = new BABYLON.Vector3(0, 2.4, -0.05);
  hair.scaling = new BABYLON.Vector3(1, 1, 0.7);
  const hairMat = new BABYLON.StandardMaterial('hairMat', scene);
  hairMat.diffuseColor = new BABYLON.Color3(0.36, 0.22, 0.12);
  hair.material = hairMat;

  // Add eyes and mouth
  const eyeMat = new BABYLON.StandardMaterial('eyeMat', scene); eyeMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
  const leftEye = BABYLON.MeshBuilder.CreateSphere('LeftEye', { diameter: 0.08 }, scene);
  leftEye.parent = head; leftEye.position = new BABYLON.Vector3(-0.12, 0.05, 0.25); leftEye.material = eyeMat;
  const rightEye = leftEye.clone('RightEye'); rightEye.parent = head; rightEye.position = new BABYLON.Vector3(0.12, 0.05, 0.25);
  const mouth = BABYLON.MeshBuilder.CreateTorus('Mouth', { diameter: 0.22, thickness: 0.03 }, scene);
  mouth.parent = head; mouth.position = new BABYLON.Vector3(0, -0.1, 0.26); mouth.rotation.x = Math.PI / 2; mouth.material = eyeMat;

  // Extend hair down sides and back to shoulders
  const hairSideL = BABYLON.MeshBuilder.CreateBox('HairSideL', { width: 0.16, height: 1.0, depth: 0.35 }, scene);
  hairSideL.parent = graceVisual; hairSideL.position = new BABYLON.Vector3(-0.42, 1.9, -0.03); hairSideL.material = hairMat;
  const hairSideR = hairSideL.clone('HairSideR'); hairSideR.parent = graceVisual; hairSideR.position = new BABYLON.Vector3(0.42, 1.9, -0.03);
  const hairBack = BABYLON.MeshBuilder.CreateBox('HairBack', { width: 0.6, height: 1.0, depth: 0.16 }, scene);
  hairBack.parent = graceVisual; hairBack.position = new BABYLON.Vector3(0, 1.9, -0.32); hairBack.material = hairMat;

  // Rat attachment anchors (top of head and shoulders)
  const headAnchor = new BABYLON.TransformNode('HeadAnchor', scene); headAnchor.parent = graceVisual; headAnchor.position = new BABYLON.Vector3(0, 2.75, 0);
  const leftShoulderAnchor = new BABYLON.TransformNode('LeftShoulderAnchor', scene); leftShoulderAnchor.parent = graceVisual; leftShoulderAnchor.position = new BABYLON.Vector3(-0.5, 1.85, 0.18);
  const rightShoulderAnchor = new BABYLON.TransformNode('RightShoulderAnchor', scene); rightShoulderAnchor.parent = graceVisual; rightShoulderAnchor.position = new BABYLON.Vector3(0.5, 1.85, 0.18);

  // Limbs
  const limbMat = new BABYLON.StandardMaterial('limbMat', scene);
  limbMat.diffuseColor = new BABYLON.Color3(0.85, 0.7, 0.6);
  function createLimb(name, height, diameter) {
    const limb = BABYLON.MeshBuilder.CreateCylinder(name, { height, diameter }, scene);
    limb.parent = graceVisual;
    limb.setPivotPoint(new BABYLON.Vector3(0, height / 2, 0));
    limb.material = limbMat;
    return limb;
  }
  const leftLeg = createLimb('LeftLeg', 1.0, 0.18); leftLeg.position = new BABYLON.Vector3(-0.25, 0.5, 0);
  const rightLeg = createLimb('RightLeg', 1.0, 0.18); rightLeg.position = new BABYLON.Vector3(0.25, 0.5, 0);
  const shoulderY = 1.6; // lower arms more
  const leftArm = createLimb('LeftArm', 0.9, 0.14); leftArm.position = new BABYLON.Vector3(-0.5, shoulderY, 0.06);
  const rightArm = createLimb('RightArm', 0.9, 0.14); rightArm.position = new BABYLON.Vector3(0.5, shoulderY, 0.06);

  // Lincoln (brother) - half-size follower NPC
  function createLincoln() {
    const collider = BABYLON.MeshBuilder.CreateCapsule('LincolnCollider', { height: 1.0, radius: 0.25 }, scene);
    collider.position = new BABYLON.Vector3(0, 0.55, 0);
    collider.checkCollisions = true;
    collider.ellipsoid = new BABYLON.Vector3(0.25, 0.5, 0.25);
    collider.ellipsoidOffset = new BABYLON.Vector3(0, 0.5, 0);
    collider.isVisible = false;

    const visual = new BABYLON.TransformNode('LincolnVisual', scene);
    visual.parent = collider;
    visual.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);

    // Torso
    const torsoL = BABYLON.MeshBuilder.CreateCapsule('LincolnTorso', { height: 1.4, radius: 0.35 }, scene);
    torsoL.parent = visual; torsoL.position = new BABYLON.Vector3(0, 1.2, 0);
    torsoL.material = graceMat;

    // Head (no hair)
    const headL = BABYLON.MeshBuilder.CreateSphere('LincolnHead', { diameter: 0.6 }, scene);
    headL.parent = visual; headL.position = new BABYLON.Vector3(0, 2.21, 0);
    headL.material = headMat;

    // Eyes & mouth
    const leftEyeL = BABYLON.MeshBuilder.CreateSphere('LincolnLeftEye', { diameter: 0.08 }, scene);
    leftEyeL.parent = headL; leftEyeL.position = new BABYLON.Vector3(-0.12, 0.05, 0.25); leftEyeL.material = eyeMat;
    const rightEyeL = leftEyeL.clone('LincolnRightEye'); rightEyeL.parent = headL; rightEyeL.position = new BABYLON.Vector3(0.12, 0.05, 0.25);
    const mouthL = BABYLON.MeshBuilder.CreateTorus('LincolnMouth', { diameter: 0.22, thickness: 0.03 }, scene);
    mouthL.parent = headL; mouthL.position = new BABYLON.Vector3(0, -0.1, 0.26); mouthL.rotation.x = Math.PI / 2; mouthL.material = eyeMat;

    // Orange clothes
    const orangeMat = new BABYLON.StandardMaterial('lincolnOrangeMat', scene);
    orangeMat.diffuseColor = new BABYLON.Color3(1.0, 0.5, 0.0);

    const shirtL = BABYLON.MeshBuilder.CreateCylinder('LincolnShirt', { height: 0.9, diameter: 0.95 }, scene);
    shirtL.parent = visual; shirtL.position = new BABYLON.Vector3(0, 1.55, 0); shirtL.material = orangeMat;

    const shortsL = BABYLON.MeshBuilder.CreateBox('LincolnShorts', { width: 0.85, height: 0.68, depth: 0.70 }, scene);
    shortsL.parent = visual; shortsL.position = new BABYLON.Vector3(0, 0.85, 0); shortsL.material = orangeMat;

    // Arms & legs
    function createLimbL(name, height, diameter) {
      const limb = BABYLON.MeshBuilder.CreateCylinder(name, { height, diameter }, scene);
      limb.parent = visual;
      limb.setPivotPoint(new BABYLON.Vector3(0, height / 2, 0));
      limb.material = limbMat;
      return limb;
    }
    const leftLegL = createLimbL('LincolnLeftLeg', 1.0, 0.18); leftLegL.position = new BABYLON.Vector3(-0.25, 0.5, 0);
    const rightLegL = createLimbL('LincolnRightLeg', 1.0, 0.18); rightLegL.position = new BABYLON.Vector3(0.25, 0.5, 0);
    const shoulderYL = 1.6;
    const leftArmL = createLimbL('LincolnLeftArm', 0.9, 0.14); leftArmL.position = new BABYLON.Vector3(-0.5, shoulderYL, 0.06);
    const rightArmL = createLimbL('LincolnRightArm', 0.9, 0.14); rightArmL.position = new BABYLON.Vector3(0.5, shoulderYL, 0.06);

    // Shoes
    function createShoeL(parent, name) {
      const shoe = BABYLON.MeshBuilder.CreateBox(name + '_Body', { width: 0.28, height: 0.12, depth: 0.5 }, scene);
      shoe.parent = parent; shoe.position = new BABYLON.Vector3(0, -1.02, 0.12); shoe.material = orangeMat;
      return shoe;
    }
    createShoeL(leftLegL, 'LincolnLeftShoe'); createShoeL(rightLegL, 'LincolnRightShoe');

    // Orange baseball cap
    const capTop = BABYLON.MeshBuilder.CreateSphere('LincolnCapTop', { diameter: 0.7, segments: 8 }, scene);
    capTop.parent = visual; capTop.position = new BABYLON.Vector3(0, 2.38, 0);
    capTop.scaling = new BABYLON.Vector3(1, 0.5, 1);
    capTop.material = orangeMat;
    const capBrim = BABYLON.MeshBuilder.CreateBox('LincolnCapBrim', { width: 0.5, height: 0.06, depth: 0.25 }, scene);
    capBrim.parent = visual; capBrim.position = new BABYLON.Vector3(0, 2.28, 0.35); capBrim.material = orangeMat;

    return {
      collider, visual,
      limbs: { leftLeg: leftLegL, rightLeg: rightLegL, leftArm: leftArmL, rightArm: rightArmL },
      state: { down: false, walkPhase: 0 }
    };
  }

  // Dakota (brother) - half-size follower NPC (blue outfit)
  function createDakota() {
    const collider = BABYLON.MeshBuilder.CreateCapsule('DakotaCollider', { height: 1.0, radius: 0.25 }, scene);
    collider.position = new BABYLON.Vector3(0, 0.55, 0);
    collider.checkCollisions = true;
    collider.ellipsoid = new BABYLON.Vector3(0.25, 0.5, 0.25);
    collider.ellipsoidOffset = new BABYLON.Vector3(0, 0.5, 0);
    collider.isVisible = false;

    const visual = new BABYLON.TransformNode('DakotaVisual', scene);
    visual.parent = collider;
    visual.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);

    // Torso
    const torsoD = BABYLON.MeshBuilder.CreateCapsule('DakotaTorso', { height: 1.4, radius: 0.35 }, scene);
    torsoD.parent = visual; torsoD.position = new BABYLON.Vector3(0, 1.2, 0);
    torsoD.material = graceMat;

    // Head (no hair)
    const headD = BABYLON.MeshBuilder.CreateSphere('DakotaHead', { diameter: 0.6 }, scene);
    headD.parent = visual; headD.position = new BABYLON.Vector3(0, 2.21, 0);
    headD.material = headMat;

    // Eyes & mouth
    const leftEyeD = BABYLON.MeshBuilder.CreateSphere('DakotaLeftEye', { diameter: 0.08 }, scene);
    leftEyeD.parent = headD; leftEyeD.position = new BABYLON.Vector3(-0.12, 0.05, 0.25); leftEyeD.material = eyeMat;
    const rightEyeD = leftEyeD.clone('DakotaRightEye'); rightEyeD.parent = headD; rightEyeD.position = new BABYLON.Vector3(0.12, 0.05, 0.25);
    const mouthD = BABYLON.MeshBuilder.CreateTorus('DakotaMouth', { diameter: 0.22, thickness: 0.03 }, scene);
    mouthD.parent = headD; mouthD.position = new BABYLON.Vector3(0, -0.1, 0.26); mouthD.rotation.x = Math.PI / 2; mouthD.material = eyeMat;

    // Blue clothes
    const blueMat = new BABYLON.StandardMaterial('dakotaBlueMat', scene);
    blueMat.diffuseColor = new BABYLON.Color3(0.2, 0.45, 1.0);

    const shirtD = BABYLON.MeshBuilder.CreateCylinder('DakotaShirt', { height: 0.9, diameter: 0.95 }, scene);
    shirtD.parent = visual; shirtD.position = new BABYLON.Vector3(0, 1.55, 0); shirtD.material = blueMat;

    const shortsD = BABYLON.MeshBuilder.CreateBox('DakotaShorts', { width: 0.85, height: 0.68, depth: 0.70 }, scene);
    shortsD.parent = visual; shortsD.position = new BABYLON.Vector3(0, 0.85, 0); shortsD.material = blueMat;

    // Arms & legs
    function createLimbD(name, height, diameter) {
      const limb = BABYLON.MeshBuilder.CreateCylinder(name, { height, diameter }, scene);
      limb.parent = visual;
      limb.setPivotPoint(new BABYLON.Vector3(0, height / 2, 0));
      limb.material = limbMat;
      return limb;
    }
    const leftLegD = createLimbD('DakotaLeftLeg', 1.0, 0.18); leftLegD.position = new BABYLON.Vector3(-0.25, 0.5, 0);
    const rightLegD = createLimbD('DakotaRightLeg', 1.0, 0.18); rightLegD.position = new BABYLON.Vector3(0.25, 0.5, 0);
    const shoulderYD = 1.6;
    const leftArmD = createLimbD('DakotaLeftArm', 0.9, 0.14); leftArmD.position = new BABYLON.Vector3(-0.5, shoulderYD, 0.06);
    const rightArmD = createLimbD('DakotaRightArm', 0.9, 0.14); rightArmD.position = new BABYLON.Vector3(0.5, shoulderYD, 0.06);

    // Shoes
    function createShoeD(parent, name) {
      const shoe = BABYLON.MeshBuilder.CreateBox(name + '_Body', { width: 0.28, height: 0.12, depth: 0.5 }, scene);
      shoe.parent = parent; shoe.position = new BABYLON.Vector3(0, -1.02, 0.12); shoe.material = blueMat;
      return shoe;
    }
    createShoeD(leftLegD, 'DakotaLeftShoe'); createShoeD(rightLegD, 'DakotaRightShoe');

    // Blue baseball cap
    const capTopD = BABYLON.MeshBuilder.CreateSphere('DakotaCapTop', { diameter: 0.7, segments: 8 }, scene);
    capTopD.parent = visual; capTopD.position = new BABYLON.Vector3(0, 2.38, 0);
    capTopD.scaling = new BABYLON.Vector3(1, 0.5, 1);
    capTopD.material = blueMat;
    const capBrimD = BABYLON.MeshBuilder.CreateBox('DakotaCapBrim', { width: 0.5, height: 0.06, depth: 0.25 }, scene);
    capBrimD.parent = visual; capBrimD.position = new BABYLON.Vector3(0, 2.28, 0.35); capBrimD.material = blueMat;

    return {
      collider, visual,
      limbs: { leftLeg: leftLegD, rightLeg: rightLegD, leftArm: leftArmD, rightArm: rightArmD },
      state: { down: false, walkPhase: 0 }
    };
  }

  // Clothes: T-shirt, shorts, and sneakers
  const shirtMat = new BABYLON.StandardMaterial('shirtMat', scene); shirtMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);
  const shortsMat = new BABYLON.StandardMaterial('shortsMat', scene); shortsMat.diffuseColor = new BABYLON.Color3(0.2, 0.35, 0.6);
  const shoeMat = new BABYLON.StandardMaterial('shoeMat', scene); shoeMat.diffuseColor = new BABYLON.Color3(0.95, 0.95, 0.95);
  const soleMat = new BABYLON.StandardMaterial('soleMat', scene); soleMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);

  // Shirt body (scaled up for clear visibility)
  const shirt = BABYLON.MeshBuilder.CreateCylinder('Shirt', { height: 0.9, diameter: 0.95 }, scene);
  shirt.parent = graceVisual; shirt.position = new BABYLON.Vector3(0, 1.55, 0); shirt.material = shirtMat;
  // Short sleeves attached to arms
  const leftSleeve = BABYLON.MeshBuilder.CreateCylinder('LeftSleeve', { height: 0.25, diameter: 0.34 }, scene);
  leftSleeve.parent = leftArm; leftSleeve.position = new BABYLON.Vector3(0, -0.05, 0); leftSleeve.material = shirtMat;
  const rightSleeve = leftSleeve.clone('RightSleeve'); rightSleeve.parent = rightArm; rightSleeve.position = new BABYLON.Vector3(0, -0.05, 0);

  // Shorts (larger to stand out)
  const shorts = BABYLON.MeshBuilder.CreateBox('Shorts', { width: 0.85, height: 0.68, depth: 0.70 }, scene);
  shorts.parent = graceVisual; shorts.position = new BABYLON.Vector3(0, 0.85, 0); shorts.material = shortsMat;

  function createShoe(parent, name) {
    const shoe = BABYLON.MeshBuilder.CreateBox(name + '_Body', { width: 0.28, height: 0.12, depth: 0.5 }, scene);
    shoe.parent = parent; shoe.position = new BABYLON.Vector3(0, -0.70, 0.12); shoe.material = shoeMat;
    const sole = BABYLON.MeshBuilder.CreateBox(name + '_Sole', { width: 0.3, height: 0.04, depth: 0.52 }, scene);
    sole.parent = parent; sole.position = new BABYLON.Vector3(0, -0.78, 0.12); sole.material = soleMat;
  }
  createShoe(leftLeg, 'LeftShoe');
  createShoe(rightLeg, 'RightShoe');

  // Camera targets the collider
  camera.setTarget(graceCollider);

  // Inverted mouse controls for yaw/tilt while keeping camera behind Grace
  let graceYaw = 0;
  let graceYawTarget = 0;
  let betaTarget = camera.beta;
  const mouseSensitivity = 0.003;
  const tiltSensitivity = 0.003;
  const yawLerp = 0.15;
  const betaLerp = 0.15;
  let lastMouseX = null;
  canvas.addEventListener('mousemove', (e) => {
    if (!gameStarted) return;
    const dx = (typeof e.movementX === 'number') ? e.movementX : (lastMouseX == null ? 0 : e.clientX - lastMouseX);
    lastMouseX = e.clientX;
    graceYawTarget += dx * mouseSensitivity; // inverted left/right
    betaTarget -= (e.movementY || 0) * tiltSensitivity; // inverted up/down
    if (betaTarget < camera.lowerBetaLimit) betaTarget = camera.lowerBetaLimit;
    if (betaTarget > camera.upperBetaLimit) betaTarget = camera.upperBetaLimit;
  });
  canvas.addEventListener('mouseleave', () => { lastMouseX = null; });
  // Pointer lock to allow continuous rotation at screen edges
  canvas.addEventListener('click', () => {
    if (!gameStarted) return;
    if (window.__hs_audio && window.__hs_audio.ensureAudio) window.__hs_audio.ensureAudio();
    if (document.pointerLockElement !== canvas) {
      canvas.requestPointerLock?.();
    }
    canvas.focus();
  });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== canvas) { lastMouseX = null; }
  });

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
  window.addEventListener('keydown', (e) => { if (!gameStarted) return; setKey(e.key, true); });
  window.addEventListener('keyup', (e) => { if (!gameStarted) return; setKey(e.key, false); });
  window.addEventListener('keydown', (e) => {
    if (!gameStarted) return;
    const isSpace = e.code === 'Space' || e.key === ' ';
    const isShift = e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift';
    if (isSpace || isShift) { e.preventDefault(); sprintHeld = true; }
  });
  window.addEventListener('keyup', (e) => {
    if (!gameStarted) return;
    const isSpace = e.code === 'Space' || e.key === ' ';
    const isShift = e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift';
    if (isSpace || isShift) { e.preventDefault(); sprintHeld = false; }
  });
  window.addEventListener('blur', () => { sprintHeld = false; });

  const moveSpeed = 0.12;
  let graceIsRunning = false;
  let sprintHeld = false;
  const step = new BABYLON.Vector3();
  // Track Grace walk speed to mirror for Lincoln
  let lastGracePos = null;
  let graceWalkSpeedMeasured = moveSpeed;
  // Footstep sync
  let prevSwing = 0;
  let lastFootTime = 0;
  function playFootstep() {
    const api = window.__hs_audio;
    if (!api || !api.ensureAudio || !api.getFootBuffer) return;
    const ctx = api.ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    // throttle steps to >= 90ms apart
    if (now - lastFootTime < 0.09) return;
    lastFootTime = now;
    const buf = api.getFootBuffer();
    if (!buf) return;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = graceIsRunning ? 280 : 220; filter.Q.value = 0.7;
    const gain = ctx.createGain();
    const vol = graceIsRunning ? 0.25 : 0.18;
    gain.gain.setValueAtTime(vol, now);
    const endTime = now + 0.16;
    gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(endTime);
  }

  let walkPhase = 0;
  scene.onBeforeRenderObservable.add(() => {
    // Normalize dt to 60fps frames (~16.67ms)
    const dtFrames = engine.getDeltaTime() / 16.67;
    // Smooth yaw/beta
    graceYaw += (graceYawTarget - graceYaw) * yawLerp;
    camera.beta += (betaTarget - camera.beta) * betaLerp;
    camera.alpha = -graceYaw - Math.PI / 2;

    if (!gameStarted) return;

    const forward = new BABYLON.Vector3(Math.sin(graceYaw), 0, Math.cos(graceYaw));
    const right = new BABYLON.Vector3(Math.cos(graceYaw), 0, -Math.sin(graceYaw));
    step.set(0, 0, 0);
    if (input.f) step.addInPlace(forward);
    if (input.b) step.subtractInPlace(forward);
    if (input.l) step.subtractInPlace(right);
    if (input.r) step.addInPlace(right);

    const isMoving = step.lengthSquared() > 0.0001;
    const speedMult = isMoving && sprintHeld ? 2.0 : 1.0;
    graceIsRunning = isMoving && sprintHeld;
    if (isMoving) {
      step.normalize().scaleInPlace(moveSpeed * speedMult * dtFrames);
      graceVisual.rotation.y = Math.atan2(step.x, step.z);
    }

    const before = graceCollider.position.clone();
    const moveVector = new BABYLON.Vector3(step.x, scene.gravity.y * 0.5, step.z);
    graceCollider.moveWithCollisions(moveVector);
    const after = graceCollider.position;
    if (lastGracePos === null) lastGracePos = before.clone();
    const frameDist = BABYLON.Vector3.Distance(after, before);
    if (dtFrames > 0) {
      const frameSpeed = frameDist / (dtFrames * (1/60)); // meters per second
      if (isMoving && !graceIsRunning) {
        // Smooth measurement to reduce jitter
        graceWalkSpeedMeasured = graceWalkSpeedMeasured * 0.85 + frameSpeed * 0.15;
      }
    }
    lastGracePos.copyFrom(after);

    // Limb walk animation
    const targetPhaseSpeed = (isMoving ? 0.12 : 0);
    walkPhase += targetPhaseSpeed * dtFrames * 60;
    const swing = isMoving ? Math.sin(walkPhase) * 0.35 : 0;
    const swingOpp = -swing;
    leftLeg.rotation.x = swing;
    rightLeg.rotation.x = swingOpp;
    leftArm.rotation.x = swingOpp * 0.7;
    rightArm.rotation.x = swing * 0.7;

    // Footstep triggers on zero-crossings of swing
    if (isMoving) {
      if (prevSwing < 0 && swing >= 0) { playFootstep(); }
      else if (prevSwing > 0 && swing <= 0) { playFootstep(); }
    }
    prevSwing = swing;
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
    const matNose = new BABYLON.StandardMaterial('matRatNose_' + id, scene);

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
    matNose.diffuseColor = new BABYLON.Color3(1.0, 0.5, 0.7);
    matNose.emissiveColor = new BABYLON.Color3(0.3, 0.15, 0.2);

    body.material = matBody;
    head.material = matHead;
    earL.material = matEar;
    earR.material = matEar;
    tail.material = matTail;

    // Nose
    const nose = BABYLON.MeshBuilder.CreateSphere('ratNose_' + id, { diameter: 0.04 }, scene);
    nose.parent = head;
    nose.position = new BABYLON.Vector3(0, 0, 0.1);
    nose.material = matNose;

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
    m.root.parent = HNSRoot;
    return { ...r, ...m, label };
  });

  // Lincoln spawn
  const lincoln = createLincoln();
  const lincolnLabel = createLabelForMesh(lincoln.collider, 'Lincoln');
  lincolnLabel.width = '180px';
  lincoln.collider.parent = HNSRoot;

  // Dakota spawn
  const dakota = createDakota();
  const dakotaLabel = createLabelForMesh(dakota.collider, 'Dakota');
  dakotaLabel.width = '180px';
  dakota.collider.parent = HNSRoot;

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
      for (const ex of exclusions) { if (BABYLON.Vector3.Distance(p, ex) < 3.0) { ok = false; break; } }
      if (ok) return new BABYLON.Vector3(p.x, 0, p.z);
    }
    return new BABYLON.Vector3(0, 0, 0);
  }

  // Place rats and Lincoln
  ratEntities.forEach(r => {
    const rp = randomSpawn([]);
    r.root.position = new BABYLON.Vector3(rp.x, 0.15, rp.z);
  });
  (function(){
    const p = randomSpawn([graceCollider.position]);
    p.y = 0.55; // keep capsule centered so feet are on ground
    lincoln.collider.position = p;
  })();
  (function(){
    const p = randomSpawn([graceCollider.position]);
    p.y = 0.55; // keep capsule centered so feet are on ground
    dakota.collider.position = p;
  })();

  // Lincoln AI and animation
  const lincolnBaseSpeed = moveSpeed;
  const lincolnStopDist = 1.8;
  function lincolnBlocked(dir, maxDist){
    const origin = lincoln.collider.position.add(new BABYLON.Vector3(0, 0.6, 0));
    const ray = new BABYLON.Ray(origin, dir, maxDist);
    const hit = scene.pickWithRay(ray, (m)=> m && m.checkCollisions === true);
    return hit && hit.hit;
  }
  function chooseLincolnDir(toGrace){
    const base = toGrace.normalize();
    if (!lincolnBlocked(base, 0.8)) return base;
    const angles = [Math.PI/4, -Math.PI/4, Math.PI/2, -Math.PI/2, (3*Math.PI)/4, -(3*Math.PI)/4];
    for (const a of angles){
      const ca = Math.cos(a), sa = Math.sin(a);
      const cand = new BABYLON.Vector3(base.x*ca - base.z*sa, 0, base.x*sa + base.z*ca);
      if (!lincolnBlocked(cand, 0.8)) return cand.normalize();
    }
    return new BABYLON.Vector3(0,0,0); // stuck
  }
  function nudgeFromWalls(){
    const origin = lincoln.collider.position.add(new BABYLON.Vector3(0,0.6,0));
    const dirs = [new BABYLON.Vector3(1,0,0), new BABYLON.Vector3(-1,0,0), new BABYLON.Vector3(0,0,1), new BABYLON.Vector3(0,0,-1)];
    for (const d of dirs){
      const hit = scene.pickWithRay(new BABYLON.Ray(origin, d, 0.5), (m)=> m && m.checkCollisions === true);
      if (hit && hit.hit) {
        lincoln.collider.position.subtractInPlace(d.scale(0.6));
      }
    }
  }
  function lincolnStandUp(){
    lincoln.state.down = false;
    lincoln.visual.rotation.z = 0;
    lincoln.visual.position = BABYLON.Vector3.Zero();
    lincoln.collider.position.y = 0.55;
    if (lincoln.state.autoUpTimer){ clearTimeout(lincoln.state.autoUpTimer); lincoln.state.autoUpTimer = null; }
  }
  function lincolnKnockDown(){
    lincoln.state.down = true;
    lincoln.visual.rotation.z = Math.PI / 2;
    lincoln.visual.position = new BABYLON.Vector3(0, -0.6, 0);
    lincoln.collider.position.y = 0.55;
    nudgeFromWalls();
    if (lincoln.state.autoUpTimer){ clearTimeout(lincoln.state.autoUpTimer); }
    lincoln.state.autoUpTimer = setTimeout(() => {
      if (lincoln.state.down) lincolnStandUp();
    }, 10000);
  }
  scene.onBeforeRenderObservable.add(() => {
    if (!gameStarted) return;
    const dtFrames = engine.getDeltaTime() / 16.67;
    if (!lincoln.state.down) {
      const toGrace = graceCollider.position.subtract(lincoln.collider.position);
      toGrace.y = 0;
      const dist = toGrace.length();
      let isMovingL = false;
      if (dist > lincolnStopDist) {
        const dir = chooseLincolnDir(toGrace);
        const base = graceWalkSpeedMeasured > 0.0001 ? graceWalkSpeedMeasured : (lincolnBaseSpeed / (1/60));
        const curSpeed = base * (graceIsRunning ? 1.5 : 1.0);
        const step = dir.scale(curSpeed * (dtFrames * (1/60)));
        const moveVec = new BABYLON.Vector3(step.x, 0, step.z);
        lincoln.collider.moveWithCollisions(moveVec);
        // keep grounded and avoid jitter
        lincoln.collider.position.y = 0.55;
        lincoln.visual.rotation.y = Math.atan2(dir.x, dir.z);
        isMovingL = true;
      }
      else {
        // near Grace: do not move
        isMovingL = false;
      }
      // Walk anim
      const targetPhaseSpeed = (isMovingL ? 0.12 : 0);
      lincoln.state.walkPhase += targetPhaseSpeed * dtFrames * 60;
      const swing = isMovingL ? Math.sin(lincoln.state.walkPhase) * 0.28 : 0;
      const swingOpp = -swing;
      lincoln.limbs.leftLeg.rotation.x = swing;
      lincoln.limbs.rightLeg.rotation.x = swingOpp;
      lincoln.limbs.leftArm.rotation.x = swingOpp * 0.7;
      lincoln.limbs.rightArm.rotation.x = swing * 0.7;
    }
    
  });

  // Dakota AI and animation
  const dakotaBaseSpeed = moveSpeed;
  const dakotaStopDist = 1.8;
  function dakotaBlocked(dir, maxDist){
    const origin = dakota.collider.position.add(new BABYLON.Vector3(0, 0.6, 0));
    const ray = new BABYLON.Ray(origin, dir, maxDist);
    const hit = scene.pickWithRay(ray, (m)=> m && m.checkCollisions === true);
    return hit && hit.hit;
  }
  function chooseDakotaDir(toGrace){
    const base = toGrace.normalize();
    if (!dakotaBlocked(base, 0.8)) return base;
    const angles = [Math.PI/4, -Math.PI/4, Math.PI/2, -Math.PI/2, (3*Math.PI)/4, -(3*Math.PI)/4];
    for (const a of angles){
      const ca = Math.cos(a), sa = Math.sin(a);
      const cand = new BABYLON.Vector3(base.x*ca - base.z*sa, 0, base.x*sa + base.z*ca);
      if (!dakotaBlocked(cand, 0.8)) return cand.normalize();
    }
    return new BABYLON.Vector3(0,0,0); // stuck
  }
  function nudgeFromWallsD(){
    const origin = dakota.collider.position.add(new BABYLON.Vector3(0,0.6,0));
    const dirs = [new BABYLON.Vector3(1,0,0), new BABYLON.Vector3(-1,0,0), new BABYLON.Vector3(0,0,1), new BABYLON.Vector3(0,0,-1)];
    for (const d of dirs){
      const hit = scene.pickWithRay(new BABYLON.Ray(origin, d, 0.5), (m)=> m && m.checkCollisions === true);
      if (hit && hit.hit) {
        dakota.collider.position.subtractInPlace(d.scale(0.6));
      }
    }
  }
  function dakotaStandUp(){
    dakota.state.down = false;
    dakota.visual.rotation.z = 0;
    dakota.visual.position = BABYLON.Vector3.Zero();
    dakota.collider.position.y = 0.55;
    if (dakota.state.autoUpTimer){ clearTimeout(dakota.state.autoUpTimer); dakota.state.autoUpTimer = null; }
  }
  function dakotaKnockDown(){
    dakota.state.down = true;
    dakota.visual.rotation.z = Math.PI / 2;
    dakota.visual.position = new BABYLON.Vector3(0, -0.6, 0);
    dakota.collider.position.y = 0.55;
    nudgeFromWallsD();
    if (dakota.state.autoUpTimer){ clearTimeout(dakota.state.autoUpTimer); }
    dakota.state.autoUpTimer = setTimeout(() => {
      if (dakota.state.down) dakotaStandUp();
    }, 10000);
  }
  scene.onBeforeRenderObservable.add(() => {
    if (!gameStarted) return;
    const dtFrames = engine.getDeltaTime() / 16.67;
    if (!dakota.state.down) {
      const toGrace = graceCollider.position.subtract(dakota.collider.position);
      toGrace.y = 0;
      const dist = toGrace.length();
      let isMovingD = false;
      if (dist > dakotaStopDist) {
        const dir = chooseDakotaDir(toGrace);
        const base = graceWalkSpeedMeasured > 0.0001 ? graceWalkSpeedMeasured : (dakotaBaseSpeed / (1/60));
        const curSpeed = base * (graceIsRunning ? 1.5 : 1.0);
        const step = dir.scale(curSpeed * (dtFrames * (1/60)));
        const moveVec = new BABYLON.Vector3(step.x, 0, step.z);
        dakota.collider.moveWithCollisions(moveVec);
        // keep grounded and avoid jitter
        dakota.collider.position.y = 0.55;
        dakota.visual.rotation.y = Math.atan2(dir.x, dir.z);
        isMovingD = true;
      }
      else {
        isMovingD = false;
      }
      // Walk anim
      const targetPhaseSpeed = (isMovingD ? 0.12 : 0);
      dakota.state.walkPhase += targetPhaseSpeed * dtFrames * 60;
      const swing = isMovingD ? Math.sin(dakota.state.walkPhase) * 0.28 : 0;
      const swingOpp = -swing;
      dakota.limbs.leftLeg.rotation.x = swing;
      dakota.limbs.rightLeg.rotation.x = swingOpp;
      dakota.limbs.leftArm.rotation.x = swingOpp * 0.7;
      dakota.limbs.rightArm.rotation.x = swing * 0.7;
    }
  });

  // Proximity & interaction
  const revealDistance = 4.0;
  const interactDistance = 2.0;
  const radarDistance = 24.0; // about twice a house length

  function updateRatLabels() {
    if (currentMode !== 'HNS') { return; }
    for (const r of ratEntities) {
      if (r.root.metadata.found) { r.label.isVisible = false; continue; }
      const d = BABYLON.Vector3.Distance(r.root.position, graceCollider.position);
      r.label.isVisible = d < revealDistance;
    }
    // Lincoln label
    const dL = BABYLON.Vector3.Distance(lincoln.collider.position, graceCollider.position);
    lincolnLabel.isVisible = dL < revealDistance;
    if (lincolnLabel.isVisible) {
      let nearUnfound = false;
      for (const r of ratEntities) {
        if (r.root.metadata.found) continue;
        const dr = BABYLON.Vector3.Distance(r.root.position, graceCollider.position);
        if (dr < radarDistance) { nearUnfound = true; break; }
      }
      const txt = lincolnLabel.metadata && lincolnLabel.metadata.textControl;
      if (txt) txt.text = nearUnfound ? 'I smell a rat!' : 'Lincoln';
    }
    // Dakota label
    const dD = BABYLON.Vector3.Distance(dakota.collider.position, graceCollider.position);
    dakotaLabel.isVisible = dD < revealDistance;
    if (dakotaLabel.isVisible) {
      let nearUnfound = false;
      for (const r of ratEntities) {
        if (r.root.metadata.found) continue;
        const dr = BABYLON.Vector3.Distance(r.root.position, graceCollider.position);
        if (dr < radarDistance) { nearUnfound = true; break; }
      }
      const txt = dakotaLabel.metadata && dakotaLabel.metadata.textControl;
      if (txt) txt.text = nearUnfound ? 'I smell a rat!' : 'Dakota';
    }
  }

  scene.onBeforeRenderObservable.add(updateRatLabels);

  // Objective HUD (top-left)
  const hud = new BABYLON.GUI.StackPanel();
  hud.width = '360px'; hud.isVertical = true;
  hud.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
  hud.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
  hud.paddingLeft = '10px'; hud.paddingTop = '10px';
  hud.zIndex = 2000;
  ui.addControl(hud);
  hud.isVisible = false;

  const title = new BABYLON.GUI.TextBlock();
  title.text = 'Find Rio, Chunk, and Snickerdoodle and bring them home!';
  title.color = 'white'; title.fontSize = 18; title.textWrapping = true; hud.addControl(title);

  const checklistContainer = new BABYLON.GUI.Rectangle();
  checklistContainer.thickness = 0; checklistContainer.background = '#00000066'; checklistContainer.width = '100%'; checklistContainer.height = 'auto';
  hud.addControl(checklistContainer);

  const checklist = new BABYLON.GUI.StackPanel(); checklist.isVertical = true; checklist.paddingTop = '6px'; checklist.paddingBottom = '6px'; checklistContainer.addControl(checklist);
  function makeItem(name){ const t = new BABYLON.GUI.TextBlock(); t.text = `[ ] ${name}`; t.color='white'; t.fontSize=16; t.textHorizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT; t.paddingLeft = 6; t.paddingRight = 6; t.height = '24px'; return t; }
  const rioItem = makeItem('Rio'); const chunkItem = makeItem('Chunk'); const snickItem = makeItem('Snickerdoodle');
  checklist.addControl(rioItem); checklist.addControl(chunkItem); checklist.addControl(snickItem);

  function updateChecklist(){
    function mark(ctrl, found){ const base = ctrl.text.replace(/^[\[\]\sx]+/, ''); ctrl.text = `${found?'[x]':'[ ]'} ${base}`; }
    const fm = {
      Rio: ratEntities.find(r=>r.name==='Rio').root.metadata.found,
      Chunk: ratEntities.find(r=>r.name==='Chunk').root.metadata.found,
      Snickerdoodle: ratEntities.find(r=>r.name==='Snickerdoodle').root.metadata.found,
    };
    mark(rioItem, fm.Rio); mark(chunkItem, fm.Chunk); mark(snickItem, fm.Snickerdoodle);
    // When all found, make guidance very clear
    if (fm.Rio && fm.Chunk && fm.Snickerdoodle) {
      title.text = "All rats found! Go to Grace's House door to finish!";
      if (homeMarker) homeMarker.isVisible = true;
    }
  }
  scene.onBeforeRenderObservable.add(updateChecklist);

  let allFound = false;
  let allFoundToastShown = false;

  function attachRatToGrace(rat) {
    // Place on anchors, ensure above surface
    let anchor = headAnchor;
    if (rat.name === 'Chunk') anchor = leftShoulderAnchor;
    else if (rat.name === 'Snickerdoodle') anchor = rightShoulderAnchor;
    rat.root.setParent(anchor);
    rat.root.position = new BABYLON.Vector3(0, 0.05, 0); // slight upward offset
    rat.root.rotation = new BABYLON.Vector3(0, 0, 0);
    rat.root.metadata.found = true;
    rat.label.isVisible = false;
  }

  window.addEventListener('keydown', (e) => {
    if (!['e','E','Space',' '].includes(e.key) && e.code !== 'Space') return;
    if (!gameStarted) return;
    if (currentMode !== 'HNS') return; // Only H&S has interactions for now
    // If moving and Space is held, treat as sprint only
    if ((e.code === 'Space' || e.key === ' ') && (input.f || input.b || input.l || input.r)) return;

    const allFoundNow = ratEntities.every(r => r.root.metadata.found);
    const wasAllFoundBefore = allFoundNow;

    // Determine door position (metadata or fallback)
    let doorPos = null;
    if (home && home.metadata && home.metadata.door) doorPos = home.metadata.door.position;
    else if (home) {
      const ext = home.getBoundingInfo().boundingBox.extendSize;
      doorPos = new BABYLON.Vector3(home.position.x, 0.95, home.position.z + ext.z + 0.03);
    }

    // Door interaction first: if near door but not all rats found, inform player
    if (doorPos) {
      const dDoor = BABYLON.Vector3.Distance(doorPos, graceCollider.position);
      if (dDoor < 2.5 && !allFoundNow) {
        showToast('You need to find all three rats first!', 2500);
        return;
      }
    }

    // Interact with nearby rat
    let interacted = false;
    for (const r of ratEntities) {
      if (r.root.metadata.found) continue;
      const d = BABYLON.Vector3.Distance(r.root.position, graceCollider.position);
      if (d < interactDistance) {
        attachRatToGrace(r);
        showToast(`You found ${r.name}! ${r.hint}`, 2500);
        interacted = true;
      }
    }

    // Prioritized interactions with Lincoln and Dakota
    if (!interacted) {
      const dL = BABYLON.Vector3.Distance(lincoln.collider.position, graceCollider.position);
      const dD = BABYLON.Vector3.Distance(dakota.collider.position, graceCollider.position);
      const inL = dL < interactDistance;
      const inD = dD < interactDistance;

      function kickL(){ const prev = rightLeg.rotation.x; rightLeg.rotation.x = prev - 1.1; setTimeout(() => { rightLeg.rotation.x = prev; }, 250); lincolnKnockDown(); }
      function kickD(){ const prev = leftLeg.rotation.x; leftLeg.rotation.x = prev - 1.1; setTimeout(() => { leftLeg.rotation.x = prev; }, 250); dakotaKnockDown(); }

      if (inL && inD) {
        if (lincoln.state.down && !dakota.state.down) { kickD(); interacted = true; }
        else if (!lincoln.state.down && dakota.state.down) { kickL(); interacted = true; }
        else if (!lincoln.state.down && !dakota.state.down) {
          if (dL <= dD) { kickL(); } else { kickD(); }
          interacted = true;
        } else {
          if (dL <= dD) { lincolnStandUp(); } else { dakotaStandUp(); }
          interacted = true;
        }
      } else if (inL) {
        if (!lincoln.state.down) { kickL(); } else { lincolnStandUp(); }
        interacted = true;
      } else if (inD) {
        if (!dakota.state.down) { kickD(); } else { dakotaStandUp(); }
        interacted = true;
      }
    }

    // If we just completed collecting all rats, show a delayed guidance toast after the pickup toast fades
    const nowAllFound = ratEntities.every(r => r.root.metadata.found);
    if (!wasAllFoundBefore && nowAllFound && !allFoundToastShown) {
      allFoundToastShown = true;
      if (homeMarker) homeMarker.isVisible = true;
      setTimeout(() => showToast("All rats found! Return to Grace's House door to finish!", 3000), 2600);
    }

    // If all rats found, require interacting with the home door to win
    if (nowAllFound) {
      if (doorPos) {
        const dDoor = BABYLON.Vector3.Distance(doorPos, graceCollider.position);
        if (dDoor < 2.5) {
          showToast('You made it home with all three rats! You win! 🎉', 4000);
          setTimeout(() => location.reload(), 5000);
        } else if (!interacted && wasAllFoundBefore) {
          showToast("All rats found! Go to Grace's House door to finish!", 2500);
        }
      }
      if (homeMarker) homeMarker.isVisible = true;
    }
  });

  // Win condition detection (H&S only)
  const winDistance = 3.0;
  let gameWon = false;
  scene.onBeforeRenderObservable.add(() => {
    if (currentMode !== 'HNS') return;
    if (!allFound || gameWon) return;
    const d = BABYLON.Vector3.Distance(graceCollider.position, home.position);
    if (d < winDistance) {
      gameWon = true;
      showToast('You made it home with all three rats! You win! 🎉', 2000);
      setTimeout(() => {
        gameStarted = false;
        // Reset simple flags/visibility
        try { if (hud) hud.isVisible = false; } catch(e){}
        currentMode = 'MENU';
        HNSRoot.setEnabled(false);
        createGameSelectScreen();
      }, 2200);
    }
  });

  // Resize
  window.addEventListener('resize', () => engine.resize());

  engine.runRenderLoop(() => { attachCameraIfNeeded(); scene.render(); });
})();