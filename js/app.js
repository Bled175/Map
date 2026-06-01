const viewport = document.getElementById("viewport");
const container = document.getElementById("map-container");
const map = document.getElementById("map");
const pinlayer = document.getElementById("pinLayer");
const popup = document.getElementById("popup");
const locationInput = document.getElementById("locationName");
const AddPinBtn = document.getElementById("AddPinBtn");
const connectionPopup = document.getElementById("ConnectionPopup");
const distanceInput = document.getElementById("distanceInput");
const transportType = document.getElementById("transportType");
const connetsumbit = document.getElementById("connetsumbit");
const linelayer = document.getElementById("lineLayer");
const fromInput = document.getElementById("fromInput");

const toInput = document.getElementById("toInput");

const searchRouteBtn = document.getElementById("searchRouteBtn");

const routeResults = document.getElementById("routeResults");

let pins = [];
let connections = [];
let connectingPin = null;
let clickX = 0;
let clickY = 0;
let targetpin = null;
let selectedLine = null;

let scale = 1;

let isDraging = false;

let startX = 0;
let startY = 0;

let translateX = 0;
let translateY = 0;

// fungsi zoom
container.addEventListener(
  "wheel",
  (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    if (e.deltaY < 0) {
      scale += 0.1;
    } else {
      scale -= 0.1;
    }

    scale = Math.min(Math.max(scale, 1), 5);

    updateTransform();
  },
  { passive: false },
);
container.addEventListener("mouseenter", () => {
  container.focus();
});

//Drag map
map.addEventListener("mousedown", (e) => {
  isDraging = true;

  startX = e.clientX - translateX;
  startY = e.clientY - translateY;
});

container.addEventListener("mousemove", (e) => {
  if (!isDraging) return;
  translateX = e.clientX - startX;
  translateY = e.clientY - startY;

  updateTransform();
});

container.addEventListener("mouseup", (e) => {
  isDraging = false;
});

function updateTransform() {
  viewport.setAttribute(
    "transform",
    `translate(${translateX} ${translateY}) scale(${scale})`,
  );
}

//tambah pin
map.addEventListener("dblclick", (e) => {
  const point = map.createSVGPoint();

  point.x = e.clientX;
  point.y = e.clientY;

  const svgPoint = point.matrixTransform(viewport.getScreenCTM().inverse());

  clickX = svgPoint.x;
  clickY = svgPoint.y;

  popup.style.display = "block";
  popup.style.left = `${e.clientX}px`;
  popup.style.top = `${e.clientY}px`;

  locationInput.focus();
});

AddPinBtn.addEventListener("click", () => {
  const name = locationInput.value.trim();

  if (!name) return;

  const pinData = {
    id: Date.now(),
    name: name,
    x: clickX,
    y: clickY,
  };

  pins.push(pinData);
  savepins();
  createPin(pinData);
  popup.style.display = "none";
  popup.value = "";
});

function saveconnectins() {
  localStorage.setItem("connections", JSON.stringify(connections));
}

function savepins() {
  localStorage.setItem("pins", JSON.stringify(pins));
}

function loadpins() {
  const savedPins = localStorage.getItem("pins");

  if (!savedPins) return;

  pins = JSON.parse(savedPins);

  pins.forEach((pin) => {
    createPin(pin);
  });
}

function loadconnections() {
  const savedConnect = localStorage.getItem("connections");

  if (!savedConnect) return;

  connections = JSON.parse(savedConnect);

  connections.forEach((connection) => {
    const fromPin = pins.find((p) => p.id === connection.from);
    const toPin = pins.find((p) => p.id === connection.to);

    if (!fromPin || !toPin) return;

    drawConnection(fromPin, toPin, connection);
  });
}

function createPin(pinData) {
  const x = pinData.x;
  const y = pinData.y;
  const name = pinData.name;

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

  const labelGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  labelGroup.setAttribute(
    "transform",
    `translate(${x - 10}, ${y - 18}) scale(0.19)`,
  );

  //icon
  const labelBg = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "rect",
  );
  labelBg.setAttribute("x", 0);
  labelBg.setAttribute("y", 0);
  labelBg.setAttribute("width", 140);
  labelBg.setAttribute("height", 30);
  labelBg.setAttribute("rx", 5);
  labelBg.setAttribute("fill", "white");
  labelBg.setAttribute("stroke", "black");

  const connectbtn = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text",
  );
  connectbtn.setAttribute("x", 90);
  connectbtn.setAttribute("y", 18);
  connectbtn.textContent = "🔗";
  connectbtn.style.cursor = "pointer";
  connectbtn.addEventListener("click", (e) => {
    connectingPin = pinData;
    e.stopPropagation();
    group.classList.add("connecting");
  });

  const btndelete = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "text",
  );
  btndelete.setAttribute("x", 115);
  btndelete.setAttribute("y", 18);
  btndelete.textContent = "🗑️";
  btndelete.style.cursor = "pointer";

  btndelete.addEventListener("click", (e) => {
    e.stopPropagation();
    deletePin(pinData.id);
  });

  const pin = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pin.setAttribute(
    "d",
    "M32,0C18.745,0,8,10.745,8,24c0,5.678,2.502,10.671,5.271,15l17.097,24.156C30.743,63.686,31.352,64,32,64 s1.257-0.314,1.632-0.844L50.729,39C53.375,35.438,56,29.678,56,24C56,10.745,45.255,0,32,0z M32,38c-7.732,0-14-6.268-14-14 s6.268-14,14-14s14,6.268,14,14S39.732,38,32,38z",
  );
  pin.setAttribute("fill", "red");
  pin.setAttribute(
    "transform",
    `translate(${x}, ${y}) scale(0.15) translate(-32, -64)`,
  );

  //text
  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
  text.setAttribute("x", 10);
  text.setAttribute("y", 18);
  text.textContent = name;
  text.setAttribute("font-size", "20");
  text.setAttribute("fill", "#000000");
  text.setAttribute("font-weight", "bold");

  labelGroup.appendChild(labelBg);
  labelGroup.appendChild(text);
  labelGroup.appendChild(connectbtn);
  labelGroup.appendChild(btndelete);

  group.appendChild(pin);
  group.appendChild(labelGroup);
  pinlayer.appendChild(group);

  group.dataset.id = pinData.id;
  group.addEventListener("click", (e) => {
    if (!connectingPin) return;

    if (connectingPin.id === pinData.id) return;

    showConnectionPopup(connectingPin, pinData, connections, e);
  });
}
//conecttionn funtion
function showConnectionPopup(from, to, connections, e) {
  targetpin = to;

  connectionPopup.style.display = "block";
  connectionPopup.style.left = `${e.clientX}px`;
  connectionPopup.style.top = `${e.clientY}px`;
}

connetsumbit.addEventListener("click", () => {
  const distance = Number(distanceInput.value);
  const type = transportType.value;
  const connection = {
    from: connectingPin.id,
    to: targetpin.id,
    type,
    distance,
  };

  connections.push(connection);
  saveconnectins(connection);
  drawConnection(connectingPin, targetpin, connection);

  connectionPopup.style.display = "none";
  distanceInput.value = "";

  document.querySelectorAll(".connecting").forEach((el) => {
    el.classList.remove("connecting");
  });
  connectingPin = null;
  targetpin = null;
});

function deletePin(id) {
  pins = pins.filter((pin) => pin.id !== id);

  connections = connections.filter((conn) => {
    return conn.from !== id && conn.to !== id;
  });
  savepins();

  saveconnectins();

  renderAll();
}

function renderAll() {
  pinlayer.innerHTML = "";
  linelayer.innerHTML = "";

  pins.forEach((pin) => {
    createPin(pin);
  });

  connections.forEach((conn) => {
    const fromPin = pins.find((p) => p.id === conn.from);

    const toPin = pins.find((p) => p.id === conn.to);

    if (!fromPin || !toPin) return;

    drawConnection(fromPin, toPin, conn);
  });
}

function drawConnection(fromPin, toPin, connection) {
  const midX = (fromPin.x + toPin.x) / 2;
  const midY = (fromPin.y + toPin.y) / 2;

  const connectGroup = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "g",
  );
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");

  bg.setAttribute("x", midX - 25);
  bg.setAttribute("y", midY - 12);
  bg.setAttribute("width", 50);
  bg.setAttribute("height", 30);
  bg.setAttribute("rx", 5);
  bg.setAttribute("fill", "white");
  bg.setAttribute("stroke", "black");

  const text = document.createElementNS("http://www.w3.org/2000/svg", "text");

  text.setAttribute("x", midX);
  text.setAttribute("y", midY - 2);
  text.setAttribute("text-anchor", "middle");
  text.setAttribute("font-size", "4");
  text.setAttribute("font-weight", "bold");
  text.setAttribute("fill", getTransportColor(connection.type));
  text.setAttribute("stroke-width", "0.2");
  text.textContent = `${connection.distance} KM`;

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", fromPin.x);
  line.setAttribute("y1", fromPin.y);
  line.setAttribute("x2", toPin.x);
  line.setAttribute("y2", toPin.y);
  line.setAttribute("stroke", getTransportColor(connection.type));
  line.setAttribute("stroke-width", 1);

  line.addEventListener("click", (e) => {
    e.stopPropagation;

    if (selectedLine) {
      selectedLine.setAttribute("stroke-width", 1);
    }
    selectedLine = connectGroup;

    line.setAttribute("stroke-width", 2);
  });

  line.dataset.from = connection.from;
  line.dataset.to = connection.to;
  line.dataset.type = connection.type;

  connectGroup.appendChild(line);
  connectGroup.appendChild(text);
  linelayer.appendChild(connectGroup);
}

function getTransportColor(type) {
  if (type === "train") return "#33E339";

  if (type === "bus") return "#A83BE8";

  if (type === "airplane") return "#000000";

  return "gray";
}

document.addEventListener("keydown", (e) => {
  if (e.key !== "Delete" && e.key !== "Backspace") return;

  if (!selectedLine) return;

  const from = Number(selectedLine.dataset.from);

  const to = Number(selectedLine.dataset.to);

  const type = selectedLine.dataset.type;

  connections = connections.filter((conn) => {
    return !(conn.from === from && conn.to === to && conn.type === type);
  });

  saveconnectins();

  selectedLine.remove();
  selectedLine = null;
});

const transportData = {

  train: {
    speed: 120,
    cost: 500
  },

  bus: {
    speed: 80,
    cost: 100
  },

  airplane: {
    speed: 800,
    cost: 1000
  }

};

function findPinByName(name) {

  return pins.find(pin => {

    return (
      pin.name.toLowerCase() ===
      name.toLowerCase()
    );

  });

}

function buildGraph() {

  const graph = {};

  pins.forEach(pin => {

    graph[pin.id] = [];

  });

  connections.forEach(conn => {

    const transport =
      transportData[conn.type];

    const duration =
      conn.distance /
      transport.speed;

    graph[conn.from].push({

      to: conn.to,

      duration,

      distance: conn.distance,

      type: conn.type

    });

    graph[conn.to].push({

      to: conn.from,

      duration,

      distance: conn.distance,

      type: conn.type

    });

  });

  return graph;

}

function findFastestRoute(
  start,
  end
) {

  const graph =
    buildGraph();

  const distances = {};

  const previous = {};

  const unvisited = [];

  pins.forEach(pin => {

    distances[pin.id] =
      Infinity;

    previous[pin.id] =
      null;

    unvisited.push(pin.id);

  });

  distances[start] = 0;

  while (unvisited.length) {

    unvisited.sort(
      (a,b) =>
      distances[a] -
      distances[b]
    );

    const current =
      unvisited.shift();

    if (current === end)
      break;

    graph[current].forEach(
      neighbor => {

        const newDistance =

          distances[current]
          +
          neighbor.duration;

        if (
          newDistance <
          distances[neighbor.to]
        ) {

          distances[
            neighbor.to
          ] = newDistance;

          previous[
            neighbor.to
          ] = current;

        }

      }
    );

  }

  const path = [];

  let current = end;

  while (current) {

    path.unshift(current);

    current =
      previous[current];

  }

  return {

    path,

    duration:
      distances[end]

  };

}

function showRoute(route) {

  routeResults.innerHTML = "";

  const names =
    route.path.map(id => {

      const pin =
        pins.find(
          p => p.id === id
        );

      return pin.name;

    });

  routeResults.innerHTML = `

    <h3>
      Route
    </h3>

    <p>
      ${names.join(" → ")}
    </p>

    <p>
      Duration:
      ${route.duration.toFixed(2)}
      Hours
    </p>

  `;

}


loadpins();

loadconnections();