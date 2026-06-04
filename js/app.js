// ============================================================
// ELEMENT REFERENCES
// ============================================================
const viewport       = document.getElementById("viewport");
const container      = document.getElementById("map-container");
const map            = document.getElementById("map");
const pinlayer       = document.getElementById("pinLayer");
const popup          = document.getElementById("popup");
const locationInput  = document.getElementById("locationName");
const AddPinBtn      = document.getElementById("AddPinBtn");
const connectionPopup = document.getElementById("ConnectionPopup");
const distanceInput  = document.getElementById("distanceInput");
const transportType  = document.getElementById("transportType");
const connetsumbit   = document.getElementById("connetsumbit");
const linelayer      = document.getElementById("lineLayer");
const fromInput      = document.getElementById("fromInput");
const routeMode      = document.getElementById("routeMode");
const toInput        = document.getElementById("toInput");
const searchRouteBtn = document.getElementById("searchRouteBtn");
const routeResults   = document.getElementById("routeResults");

// ============================================================
// STATE
// ============================================================
let pins          = [];
let connections   = [];
let connectingPin = null; // pin yang sedang dalam mode "connect"
let targetpin     = null; // pin tujuan koneksi
let clickX        = 0;
let clickY        = 0;
let selectedLine  = null; // connectGroup yang sedang dipilih

// State untuk pan & zoom
let scale      = 1;
let isDragging = false;
let startX     = 0;
let startY     = 0;
let translateX = 0;
let translateY = 0;

// ============================================================
// TRANSPORT CONFIG
// ============================================================
const transportData = {
  train:    { speed: 120, cost: 500  },
  bus:      { speed: 80,  cost: 100  },
  airplane: { speed: 800, cost: 1000 },
};

// Offset visual supaya garis tidak saling tumpuk
const transportOffset = {
  train:    -2,
  bus:       0,
  airplane:  2,
};

// ============================================================
// ZOOM — Scroll (Ctrl + Wheel)
// ============================================================
container.addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();

    scale += e.deltaY < 0 ? 0.1 : -0.1;
    scale = Math.min(Math.max(scale, 1), 5);
    updateTransform();
  },
  { passive: false }
);

// Fokus container saat mouse masuk agar keyboard shortcut berfungsi
container.addEventListener("mouseenter", () => container.focus());

// ============================================================
// ZOOM — Keyboard (Ctrl + / Ctrl -)
// ============================================================
document.addEventListener("keydown", (e) => {
  if (!e.ctrlKey) return;

  if (e.key === "+" || e.key === "=") {
    e.preventDefault();
    scale = Math.min(scale + 0.1, 5);
    updateTransform();
  }

  if (e.key === "-") {
    e.preventDefault();
    scale = Math.max(scale - 0.1, 1);
    updateTransform();
  }
});

// ============================================================
// PAN (Drag)
// ============================================================
map.addEventListener("mousedown", (e) => {
  isDragging = true;
  startX = e.clientX - translateX;
  startY = e.clientY - translateY;
});

container.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  translateX = e.clientX - startX;
  translateY = e.clientY - startY;
  updateTransform();
});

container.addEventListener("mouseup", () => {
  isDragging = false;
});

/**
 * Terapkan transformasi translate + scale ke SVG viewport.
 */
function updateTransform() {
  viewport.setAttribute(
    "transform",
    `translate(${translateX} ${translateY}) scale(${scale})`
  );
}

// ============================================================
// TAMBAH PIN — Double click pada map
// ============================================================
map.addEventListener("dblclick", (e) => {
  // Konversi koordinat layar ke koordinat SVG
  const point = map.createSVGPoint();
  point.x = e.clientX;
  point.y = e.clientY;

  const svgPoint = point.matrixTransform(viewport.getScreenCTM().inverse());
  clickX = svgPoint.x;
  clickY = svgPoint.y;

  popup.style.display = "block";
  popup.style.left = `${e.clientX}px`;
  popup.style.top  = `${e.clientY}px`;
  locationInput.focus();
});

AddPinBtn.addEventListener("click", () => {
  const name = locationInput.value.trim();
  if (!name) return;

  const pinData = {
    id: Date.now(),
    name,
    x: clickX,
    y: clickY,
  };

  pins.push(pinData);
  savePins();
  createPin(pinData);

  popup.style.display = "none";
  locationInput.value = "";
});

// ============================================================
// STORAGE — Save & Load
// ============================================================

/** Simpan semua pins ke localStorage. */
function savePins() {
  localStorage.setItem("pins", JSON.stringify(pins));
}

/** Simpan semua connections ke localStorage. */
function saveConnections() {
  localStorage.setItem("connections", JSON.stringify(connections));
}

/** Muat pins dari localStorage dan render ke map. */
function loadPins() {
  const saved = localStorage.getItem("pins");
  if (!saved) return;

  pins = JSON.parse(saved);
  pins.forEach((pin) => createPin(pin));
}

/** Muat connections dari localStorage dan render ke map. */
function loadConnections() {
  const saved = localStorage.getItem("connections");
  if (!saved) return;

  connections = JSON.parse(saved);
  connections.forEach((conn) => {
    const fromPin = pins.find((p) => p.id === conn.from);
    const toPin   = pins.find((p) => p.id === conn.to);
    if (!fromPin || !toPin) return;
    drawConnection(fromPin, toPin, conn);
  });
}

// ============================================================
// RENDER PIN
// ============================================================

/**
 * Buat elemen SVG untuk sebuah pin dan tambahkan ke pinlayer.
 * @param {Object} pinData - { id, name, x, y }
 */
function createPin(pinData) {
  const { x, y, name } = pinData;

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.dataset.id = pinData.id;

  // --- Label group (background + text + tombol) ---
  const labelGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  labelGroup.setAttribute("transform", `translate(${x - 10}, ${y - 18}) scale(0.19)`);

  // Background label
  const labelBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  labelBg.setAttribute("x",      0);
  labelBg.setAttribute("y",      0);
  labelBg.setAttribute("width",  140);
  labelBg.setAttribute("height", 30);
  labelBg.setAttribute("rx",     5);
  labelBg.setAttribute("fill",   "white");
  labelBg.setAttribute("stroke", "black");

  // Teks nama lokasi
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x",           10);
  text.setAttribute("y",           18);
  text.setAttribute("font-size",   "20");
  text.setAttribute("fill",        "#000000");
  text.setAttribute("font-weight", "bold");
  text.textContent = name;

  // Tombol koneksi 🔗
  const connectBtn = document.createElementNS("http://www.w3.org/2000/svg", "text");
  connectBtn.setAttribute("x", 90);
  connectBtn.setAttribute("y", 18);
  connectBtn.textContent    = "🔗";
  connectBtn.style.cursor   = "pointer";
  connectBtn.addEventListener("click", (e) => {
    connectingPin = pinData;
    e.stopPropagation();
    group.classList.add("connecting");
  });

  // Tombol hapus 🗑️
  const deleteBtn = document.createElementNS("http://www.w3.org/2000/svg", "text");
  deleteBtn.setAttribute("x", 115);
  deleteBtn.setAttribute("y", 18);
  deleteBtn.textContent  = "🗑️";
  deleteBtn.style.cursor = "pointer";
  deleteBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    deletePin(pinData.id);
  });

  // Icon pin (path SVG bentuk teardrop)
  const pinIcon = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pinIcon.setAttribute(
    "d",
    "M32,0C18.745,0,8,10.745,8,24c0,5.678,2.502,10.671,5.271,15l17.097,24.156C30.743,63.686,31.352,64,32,64 s1.257-0.314,1.632-0.844L50.729,39C53.375,35.438,56,29.678,56,24C56,10.745,45.255,0,32,0z M32,38c-7.732,0-14-6.268-14-14 s6.268-14,14-14s14,6.268,14,14S39.732,38,32,38z"
  );
  pinIcon.setAttribute("fill",      "red");
  pinIcon.setAttribute("transform", `translate(${x}, ${y}) scale(0.15) translate(-32, -64)`);

  // Susun elemen ke dalam group
  labelGroup.appendChild(labelBg);
  labelGroup.appendChild(text);
  labelGroup.appendChild(connectBtn);
  labelGroup.appendChild(deleteBtn);

  group.appendChild(pinIcon);
  group.appendChild(labelGroup);
  pinlayer.appendChild(group);

  // Klik pada pin saat dalam mode "connecting" → tampilkan popup koneksi
  group.addEventListener("click", (e) => {
    if (!connectingPin) return;
    if (connectingPin.id === pinData.id) return; // tidak bisa connect ke diri sendiri
    showConnectionPopup(connectingPin, pinData, e);
  });
}

// ============================================================
// KONEKSI — Popup & Submit
// ============================================================

/**
 * Tampilkan popup input detail koneksi (jarak & tipe transport).
 * @param {Object} from - pin asal
 * @param {Object} to   - pin tujuan
 * @param {MouseEvent} e
 */
function showConnectionPopup(from, to, e) {
  targetpin = to;
  connectionPopup.style.display = "block";
  connectionPopup.style.left    = `${e.clientX}px`;
  connectionPopup.style.top     = `${e.clientY}px`;
}

connetsumbit.addEventListener("click", () => {
  const distance = Number(distanceInput.value);
  const type     = transportType.value;

  const connection = {
    from:     connectingPin.id,
    to:       targetpin.id,
    type,
    distance,
  };

  connections.push(connection);
  saveConnections();
  drawConnection(connectingPin, targetpin, connection);

  // Reset state koneksi
  connectionPopup.style.display = "none";
  distanceInput.value = "";
  document.querySelectorAll(".connecting").forEach((el) => el.classList.remove("connecting"));
  connectingPin = null;
  targetpin     = null;
});

// ============================================================
// HAPUS PIN
// ============================================================

/**
 * Hapus pin beserta semua koneksi yang terhubung dengannya.
 * @param {number} id - id pin yang akan dihapus
 */
function deletePin(id) {
  pins        = pins.filter((pin)  => pin.id !== id);
  connections = connections.filter((conn) => conn.from !== id && conn.to !== id);

  savePins();
  saveConnections();
  renderAll();
}

// ============================================================
// RENDER ULANG SEMUA
// ============================================================

/** Hapus semua elemen SVG dan render ulang dari data state. */
function renderAll() {
  pinlayer.innerHTML  = "";
  linelayer.innerHTML = "";

  pins.forEach((pin) => createPin(pin));

  connections.forEach((conn) => {
    const fromPin = pins.find((p) => p.id === conn.from);
    const toPin   = pins.find((p) => p.id === conn.to);
    if (!fromPin || !toPin) return;
    drawConnection(fromPin, toPin, conn);
  });
}

// ============================================================
// RENDER GARIS KONEKSI
// ============================================================

/**
 * Gambar garis koneksi antara dua pin di SVG linelayer.
 * Garis digeser sedikit (offset) per tipe transport agar tidak tumpang tindih.
 * @param {Object} fromPin     - pin asal
 * @param {Object} toPin       - pin tujuan
 * @param {Object} connection  - data koneksi { from, to, type, distance }
 */
function drawConnection(fromPin, toPin, connection) {
  const offset = transportOffset[connection.type] ?? 0;

  const dx = toPin.x - fromPin.x;
  const dy = toPin.y - fromPin.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Hindari pembagian nol jika dua pin di posisi yang sama
  const offsetX = length > 0 ? (-dy / length) * offset : 0;
  const offsetY = length > 0 ? ( dx / length) * offset : 0;

  const midX = (fromPin.x + toPin.x) / 2 + offsetX * 2;
  const midY = (fromPin.y + toPin.y) / 2 + offsetY * 2;

  const color = getTransportColor(connection.type);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);

  if (angle > 90 ||angle < -90) {
    angle += 180;
  }

  // --- Group container untuk garis + label ---
  const connectGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
  connectGroup.dataset.from = connection.from;
  connectGroup.dataset.to   = connection.to;
  connectGroup.dataset.type = connection.type;

  // Garis koneksi
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1",           fromPin.x + offsetX);
  line.setAttribute("y1",           fromPin.y + offsetY);
  line.setAttribute("x2",           toPin.x   + offsetX);
  line.setAttribute("y2",           toPin.y   + offsetY);
  line.setAttribute("stroke",       color);
  line.setAttribute("stroke-width", 1);

  // Klik garis → pilih untuk dihighlight / dihapus
  line.addEventListener("click", (e) => {
    e.stopPropagation();
    if (selectedLine) {
      // Reset highlight garis sebelumnya
      selectedLine.querySelector("line").setAttribute("stroke-width", 1);
    }
    selectedLine = connectGroup;
    line.setAttribute("stroke-width", 2);
  });

  // Label jarak di tengah garis
  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x",           midX);
  label.setAttribute("y",           midY - 2);
  label.setAttribute("text-anchor", "middle");
  label.setAttribute("font-size",   "4");
  label.setAttribute("font-weight", "bold");
  label.setAttribute("fill",        color);
  label.setAttribute("stroke",      "none");
  label.setAttribute("transform",   `rotate(${angle} ${midX} ${midY})`);
  label.textContent = `${connection.distance} KM`;

  connectGroup.appendChild(line);
  connectGroup.appendChild(label);
  linelayer.appendChild(connectGroup);
}

/**
 * Kembalikan warna berdasarkan tipe transport.
 * @param {string} type - "train" | "bus" | "airplane"
 * @returns {string} warna hex
 */
function getTransportColor(type) {
  const colors = {
    train:    "#33E339",
    bus:      "#A83BE8",
    airplane: "#000000",
  };
  return colors[type] ?? "gray";
}

// ============================================================
// HAPUS KONEKSI — Keyboard Delete / Backspace
// ============================================================
document.addEventListener("keydown", (e) => {
  if (e.key !== "Delete" && e.key !== "Backspace") return;
  if (!selectedLine) return;

  const from = Number(selectedLine.dataset.from);
  const to   = Number(selectedLine.dataset.to);
  const type = selectedLine.dataset.type;

  // Hapus dari array state
  connections = connections.filter(
    (conn) => !(conn.from === from && conn.to === to && conn.type === type)
  );

  saveConnections();
  selectedLine.remove();
  selectedLine = null;
});

// ============================================================
// ROUTE SEARCH
// ============================================================
searchRouteBtn.addEventListener("click", () => {
  const fromPin = findPinByName(fromInput.value);
  const toPin   = findPinByName(toInput.value);

  if (!fromPin || !toPin) {
    routeResults.innerHTML = "Location not found";
    return;
  }

  // Cari semua rute (maks 10) lalu hitung data masing-masing
  const allPaths = findAllRoutes(fromPin.id, toPin.id);
  const routes   = allPaths.map((path) => calculateRouteData(path));

  // Urutkan berdasarkan mode
  const sortKey = routeMode.value === "fastest" ? "totalDuration" : "totalCost";
  routes.sort((a, b) => a[sortKey] - b[sortKey]);

  const topRoutes = routes.slice(0, 10);

  if (topRoutes.length === 0) {
    routeResults.innerHTML = "No route available";
    return;
  }

  showRoutes(topRoutes);
  highlightRoute(topRoutes[0]);
});

/**
 * Cari pin berdasarkan nama (case-insensitive).
 * @param {string} name
 * @returns {Object|undefined}
 */
function findPinByName(name) {
  return pins.find((pin) => pin.name.toLowerCase() === name.trim().toLowerCase());
}

// ============================================================
// GRAPH & PATHFINDING
// ============================================================

/**
 * Bangun adjacency list graph dari data connections.
 * Setiap edge memiliki properti: to, duration, cost, distance, type.
 * Graph bersifat bidirectional (undirected).
 * @returns {Object} graph
 */
function buildGraph() {
  const graph = {};

  pins.forEach((pin) => {
    graph[pin.id] = [];
  });

  connections.forEach((conn) => {
    const { speed, cost } = transportData[conn.type];
    const duration = conn.distance / speed;
    const totalCost = conn.distance * cost;

    const edge = { to: conn.to,   duration, cost: totalCost, distance: conn.distance, type: conn.type };
    const back = { to: conn.from, duration, cost: totalCost, distance: conn.distance, type: conn.type };

    graph[conn.from].push(edge);
    graph[conn.to].push(back);
  });

  return graph;
}

/**
 * Temukan semua rute dari start ke end menggunakan DFS.
 * Berhenti setelah menemukan 10 rute untuk efisiensi.
 * @param {number} start
 * @param {number} end
 * @returns {Array<Array<number>>} array of paths (tiap path = array id pin)
 */
function findAllRoutes(start, end) {
  const graph  = buildGraph();
  const routes = [];

  function dfs(current, path, visited) {
    if (routes.length >= 10) return;

    if (current === end) {
      routes.push([...path]);
      return;
    }

    for (const neighbor of graph[current]) {
      if (visited.has(neighbor.to)) continue;

      visited.add(neighbor.to);
      path.push(neighbor.to);
      dfs(neighbor.to, path, visited);
      path.pop();
      visited.delete(neighbor.to);
    }
  }

  dfs(start, [start], new Set([start]));
  return routes;
}

/**
 * Hitung total durasi, biaya, dan langkah-langkah untuk sebuah path.
 * @param {Array<number>} path - array id pin
 * @returns {{ path, steps, totalDuration, totalCost }}
 */
function calculateRouteData(path) {
  let totalDuration = 0;
  let totalCost     = 0;
  const steps       = [];

  for (let i = 0; i < path.length - 1; i++) {
    const from = path[i];
    const to   = path[i + 1];

    // Cari koneksi (bidirectional)
    const conn = connections.find(
      (c) => (c.from === from && c.to === to) || (c.from === to && c.to === from)
    );
    if (!conn) continue;

    const { speed, cost } = transportData[conn.type];
    const stepDuration    = conn.distance / speed;
    const stepCost        = conn.distance * cost;

    totalDuration += stepDuration;
    totalCost     += stepCost;

    steps.push({ ...conn, duration: stepDuration, cost: stepCost });
  }

  return { path, steps, totalDuration, totalCost };
}

// ============================================================
// TAMPILKAN HASIL RUTE
// ============================================================

/**
 * Render daftar rute ke panel routeResults.
 * @param {Array} routes - hasil calculateRouteData yang sudah diurutkan
 */
function showRoutes(routes) {
  routeResults.innerHTML = "";

  routes.forEach((route, index) => {
    const names = route.path.map((id) => pins.find((p) => p.id === id)?.name ?? id);

    const stepsHtml = route.steps
      .map((step) => `<li>${step.type} (${step.distance} KM)</li>`)
      .join("");

    routeResults.innerHTML += `
      <div class="route-card">
        <h3>Route ${index + 1}</h3>
        <p>${names.join(" → ")}</p>
        <ul>${stepsHtml}</ul>
        <p>Duration: ${route.totalDuration.toFixed(2)} h</p>
        <p>Cost: Rp${route.totalCost.toLocaleString()}</p>
      </div>
    `;
  });
}

/**
 * Highlight garis-garis yang termasuk rute terbaik di peta.
 * @param {Object} route - rute terpilih
 */
function highlightRoute(route) {
  clearRouteHighlight();

  const routeEdges = new Set();
  for (let i = 0; i < route.path.length - 1; i++) {
    routeEdges.add(`${route.path[i]}-${route.path[i + 1]}`);
    routeEdges.add(`${route.path[i + 1]}-${route.path[i]}`); // bidirectional
  }

  document.querySelectorAll("#lineLayer g").forEach((group) => {
    const key = `${group.dataset.from}-${group.dataset.to}`;
    if (routeEdges.has(key)) {
      group.classList.add("route-active");
    } else {
      group.classList.add("route-inactive");
    }
  });
}

/** Hapus semua class highlight dari garis koneksi. */
function clearRouteHighlight() {
  document.querySelectorAll("#lineLayer g").forEach((group) => {
    group.classList.remove("route-active", "route-inactive");
  });
}

// ============================================================
// INIT
// ============================================================
loadPins();
loadConnections();