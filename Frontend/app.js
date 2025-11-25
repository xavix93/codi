const API_URL = "https://codi-nex3.onrender.com//api";

let currentUser = null;
let currentDate = new Date().toISOString().slice(0, 10);

const usernameInput = document.getElementById("username");
const btnLogin = document.getElementById("btnLogin");
const currentUserLabel = document.getElementById("currentUser");
const dateInput = document.getElementById("currentDate");
const btnLoadEvents = document.getElementById("btnLoadEvents");

const loginSection = document.getElementById("login-section");
const dateSection = document.getElementById("date-section");
const createEventSection = document.getElementById("create-event-section");
const eventsSection = document.getElementById("events-section");

const eventTitle = document.getElementById("eventTitle");
const eventDescription = document.getElementById("eventDescription");
const eventStart = document.getElementById("eventStart");
const eventEnd = document.getElementById("eventEnd");
const eventRecurrence = document.getElementById("eventRecurrence");
const eventSharedWith = document.getElementById("eventSharedWith");
const btnCreateEvent = document.getElementById("btnCreateEvent");

const eventsList = document.getElementById("eventsList");

dateInput.value = currentDate;

// 1) Login simple
btnLogin.addEventListener("click", async () => {
  const name = usernameInput.value.trim();
  if (!name) {
    alert("Ingresa un nombre");
    return;
  }

  const res = await fetch(`${API_URL}/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name })
  });

  const user = await res.json();
  currentUser = user;
  currentUserLabel.textContent = `Usuario actual: ${user.name} (id: ${user.id})`;

  dateSection.classList.remove("hidden");
  createEventSection.classList.remove("hidden");
  eventsSection.classList.remove("hidden");
});

// 2) Cargar eventos del día
btnLoadEvents.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Primero inicia sesión");
    return;
  }
  currentDate = dateInput.value || new Date().toISOString().slice(0, 10);

  const url = `${API_URL}/events?userId=${currentUser.id}&date=${currentDate}`;
  const res = await fetch(url);
  const data = await res.json();

  renderEvents(data.events);
});

// 3) Crear evento
btnCreateEvent.addEventListener("click", async () => {
  if (!currentUser) {
    alert("Primero inicia sesión");
    return;
  }

  const title = eventTitle.value.trim();
  const description = eventDescription.value.trim();
  const start = eventStart.value;
  const end = eventEnd.value;
  const recurrence = eventRecurrence.value;
  const sharedRaw = eventSharedWith.value;

  if (!title || !start || !end) {
    alert("Título, inicio y fin son obligatorios");
    return;
  }

  const sharedWithNames = sharedRaw
    .split(",")
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const body = {
    title,
    description,
    start,
    end,
    recurrence,
    ownerId: currentUser.id,
    sharedWithNames
  };

  const res = await fetch(`${API_URL}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const data = await res.json();
  alert("Evento creado (id " + data.eventId + ")");
  // limpiar formulario
  eventTitle.value = "";
  eventDescription.value = "";
  eventStart.value = "";
  eventEnd.value = "";
  eventSharedWith.value = "";
  eventRecurrence.value = "NONE";

  // recargar eventos
  btnLoadEvents.click();
});

// 4) Renderizar eventos
function renderEvents(events) {
  eventsList.innerHTML = "";

  if (!events || events.length === 0) {
    eventsList.textContent = "No hay eventos para esta fecha.";
    return;
  }

  events.forEach(ev => {
    const card = document.createElement("div");
    card.className = "event-card";

    const header = document.createElement("div");
    header.className = "event-header";

    const title = document.createElement("div");
    title.innerHTML = `<strong>${ev.title}</strong><br><small>Dueño: ${ev.ownerName}</small>`;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = ev.recurrence === "NONE"
      ? "Una vez"
      : ev.recurrence === "HOURLY"
      ? "Cada hora"
      : "Cada día";

    header.appendChild(title);
    header.appendChild(badge);

    const body = document.createElement("div");
    const start = new Date(ev.start);
    const end = new Date(ev.end);

    body.innerHTML = `
      <p>${ev.description || ""}</p>
      <p><strong>Inicio:</strong> ${start.toLocaleString()}</p>
      <p><strong>Fin:</strong> ${end.toLocaleString()}</p>
      <p><strong>Compartido con:</strong> ${
        ev.sharedWith.length
          ? ev.sharedWith.map(u => u.name).join(", ")
          : "(solo el dueño)"
      }</p>
    `;

    const completed = document.createElement("div");
    completed.className = "completed-users";
    const completedNames = ev.completedBy.map(u => u.name);
    completed.textContent =
      completedNames.length > 0
        ? "Ya cumplido por: " + completedNames.join(", ")
        : "Nadie lo ha marcado como cumplido aún.";

    const btnComplete = document.createElement("button");
    btnComplete.textContent = "Marcar como cumplido";
    btnComplete.addEventListener("click", async () => {
      await fetch(`${API_URL}/events/${ev.id}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          date: currentDate
        })
      });
      // recargar lista
      btnLoadEvents.click();
    });

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(completed);
    card.appendChild(btnComplete);

    eventsList.appendChild(card);
  });
}
