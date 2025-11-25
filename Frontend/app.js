const API_URL = "https://codi-nex3.onrender.com/api";

const STORAGE_USER_KEY = "calendar-current-user";

let currentUser = null;

// Estado del calendario (mes/año visualizado y día seleccionado)
let viewDate = new Date(); // mes actual
let selectedDate = new Date(); // día seleccionado (por defecto, hoy)

// Referencias DOM
const usernameInput = document.getElementById("username");
const btnLogin = document.getElementById("btnLogin");
const btnLogout = document.getElementById("btnLogout");
const currentUserLabel = document.getElementById("currentUser");

const loginSection = document.getElementById("login-section");
const userInfoSection = document.getElementById("user-info");

const monthLabel = document.getElementById("monthLabel");
const prevMonthBtn = document.getElementById("prevMonth");
const nextMonthBtn = document.getElementById("nextMonth");
const calendarGrid = document.getElementById("calendarGrid");

const selectedDateLabel = document.getElementById("selectedDateLabel");
const currentDateInput = document.getElementById("currentDate");
const btnLoadEvents = document.getElementById("btnLoadEvents");

const eventsList = document.getElementById("eventsList");

const createEventSection = document.getElementById("create-event-section");
const eventTitle = document.getElementById("eventTitle");
const eventDescription = document.getElementById("eventDescription");
const eventStart = document.getElementById("eventStart");
const eventEnd = document.getElementById("eventEnd");
const eventRecurrence = document.getElementById("eventRecurrence");
const eventSharedWith = document.getElementById("eventSharedWith");
const btnCreateEvent = document.getElementById("btnCreateEvent");

// === Funciones de ayuda ===

function formatDateYYYYMMDD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateHuman(date) {
  return date.toLocaleDateString("es-CL", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

// === Manejo de usuario / login ===

function applyLoggedInState(user) {
  currentUser = user;
  currentUserLabel.textContent = `Usuario: ${user.name} (id: ${user.id})`;

  loginSection.classList.add("hidden");
  userInfoSection.classList.remove("hidden");
  createEventSection.classList.remove("hidden");

  // Sincronizar fecha seleccionada en el input (aunque esté oculto)
  const sel = formatDateYYYYMMDD(selectedDate);
  currentDateInput.value = sel;
  updateSelectedDateLabel();

  // Cargar eventos para el día seleccionado
  loadEventsForDate(sel);
}

function initUserFromStorage() {
  const stored = localStorage.getItem(STORAGE_USER_KEY);
  if (!stored) return;

  try {
    const user = JSON.parse(stored);
    if (user && user.id && user.name) {
      usernameInput.value = user.name;
      applyLoggedInState(user);
    }
  } catch (e) {
    console.error("Error leyendo usuario guardado:", e);
  }
}

// === Calendario ===

function renderCalendar() {
  calendarGrid.innerHTML = "";

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth(); // 0-11

  // Etiqueta del mes
  const formatter = new Intl.DateTimeFormat("es-CL", {
    month: "long",
    year: "numeric"
  });
  monthLabel.textContent = formatter.format(viewDate);

  // Calcular primer día y cantidad de días
  const firstDay = new Date(year, month, 1); // 1er día del mes
  const firstDayWeekday = (firstDay.getDay() + 6) % 7; 
  // getDay(): 0=Dom...6=Sab, lo convertimos a 0=Lun...6=Dom

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // Generamos 42 celdas (6 filas x 7 columnas)
  for (let i = 0; i < 42; i++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";

    let dayNumber;
    let cellDate;
    let isOtherMonth = false;

    if (i < firstDayWeekday) {
      // Días del mes anterior
      dayNumber = daysInPrevMonth - firstDayWeekday + 1 + i;
      cellDate = new Date(year, month - 1, dayNumber);
      isOtherMonth = true;
    } else if (i >= firstDayWeekday + daysInMonth) {
      // Días del siguiente mes
      dayNumber = i - (firstDayWeekday + daysInMonth) + 1;
      cellDate = new Date(year, month + 1, dayNumber);
      isOtherMonth = true;
    } else {
      // Días del mes actual
      dayNumber = i - firstDayWeekday + 1;
      cellDate = new Date(year, month, dayNumber);
    }

    const dayNumDiv = document.createElement("div");
    dayNumDiv.className = "day-number";
    dayNumDiv.textContent = dayNumber;
    cell.appendChild(dayNumDiv);

    if (isOtherMonth) {
      cell.classList.add("other-month");
    }

    // Marcar hoy
    const today = new Date();
    if (
      cellDate.getFullYear() === today.getFullYear() &&
      cellDate.getMonth() === today.getMonth() &&
      cellDate.getDate() === today.getDate()
    ) {
      cell.classList.add("today");
    }

    // Marcar día seleccionado
    if (
      cellDate.getFullYear() === selectedDate.getFullYear() &&
      cellDate.getMonth() === selectedDate.getMonth() &&
      cellDate.getDate() === selectedDate.getDate()
    ) {
      cell.classList.add("selected-day");
    }

    // Click en un día del calendario
    cell.addEventListener("click", () => {
      selectedDate = cellDate;
      const selStr = formatDateYYYYMMDD(selectedDate);
      currentDateInput.value = selStr;
      updateSelectedDateLabel();
      renderCalendar(); // para refrescar la selección

      if (currentUser) {
        loadEventsForDate(selStr);
        // Además, prefijar las fechas de inicio/fin del evento nuevo
        setDefaultEventDateTime(selectedDate);
      }
    });

    calendarGrid.appendChild(cell);
  }
}

function updateSelectedDateLabel() {
  selectedDateLabel.textContent = `Eventos del día: ${formatDateHuman(
    selectedDate
  )}`;
}

// Prefija la fecha del evento nuevo al día seleccionado
function setDefaultEventDateTime(date) {
  const ymd = formatDateYYYYMMDD(date);
  eventStart.value = `${ymd}T09:00`;
  eventEnd.value = `${ymd}T10:00`;
}

// === Eventos (cargar, renderizar, crear, completar) ===

async function loadEventsForDate(dateStr) {
  if (!currentUser) {
    return;
  }

  try {
    const url = `${API_URL}/events?userId=${currentUser.id}&date=${dateStr}`;
    const res = await fetch(url);
    const data = await res.json();
    renderEvents(data.events);
  } catch (err) {
    console.error("Error al cargar eventos:", err);
    eventsList.textContent = "Error al cargar eventos.";
  }
}

function renderEvents(events) {
  eventsList.innerHTML = "";

  if (!events || events.length === 0) {
    eventsList.textContent = "No hay eventos para este día.";
    return;
  }

  events.forEach((ev) => {
    const card = document.createElement("div");
    card.className = "event-card";

    const header = document.createElement("div");
    header.className = "event-header";

    const title = document.createElement("div");
    title.innerHTML = `<strong>${ev.title}</strong><br><small>Dueño: ${ev.ownerName}</small>`;

    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent =
      ev.recurrence === "NONE"
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
          ? ev.sharedWith.map((u) => u.name).join(", ")
          : "(solo el dueño)"
      }</p>
    `;

    const completed = document.createElement("div");
    completed.className = "completed-users";
    const completedNames = ev.completedBy.map((u) => u.name);
    completed.textContent =
      completedNames.length > 0
        ? "Ya cumplido por: " + completedNames.join(", ")
        : "Nadie lo ha marcado como cumplido aún.";

    const btnComplete = document.createElement("button");
    btnComplete.textContent = "Marcar como cumplido";
    btnComplete.addEventListener("click", async () => {
      try {
        await fetch(`${API_URL}/events/${ev.id}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUser.id,
            date: formatDateYYYYMMDD(selectedDate)
          })
        });
        // recargar eventos
        loadEventsForDate(formatDateYYYYMMDD(selectedDate));
      } catch (err) {
        console.error("Error al marcar como cumplido:", err);
        alert("Error al marcar como cumplido");
      }
    });

    card.appendChild(header);
    card.appendChild(body);
    card.appendChild(completed);
    card.appendChild(btnComplete);

    eventsList.appendChild(card);
  });
}

// === Listeners ===

// Login
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
  localStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user));
  applyLoggedInState(user);

  // Prefijar fecha de evento nuevo
  setDefaultEventDateTime(selectedDate);
});

// Logout
btnLogout.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_USER_KEY);
  currentUser = null;
  userInfoSection.classList.add("hidden");
  createEventSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
  eventsList.innerHTML = "Inicia sesión para ver tus eventos.";
});

// Navegación de meses
prevMonthBtn.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
  renderCalendar();
});

nextMonthBtn.addEventListener("click", () => {
  viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
  renderCalendar();
});

// Botón oculto de "Cargar eventos" (por compatibilidad, pero no se usa manualmente)
btnLoadEvents.addEventListener("click", () => {
  if (!currentUser) return;
  const dateStr = currentDateInput.value || formatDateYYYYMMDD(selectedDate);
  loadEventsForDate(dateStr);
});

// Crear evento
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
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const body = {
    title,
    description,
    start,
    end,
    recurrence,
    ownerId: currentUser.id,
    sharedWithNames
  };

  try {
    const res = await fetch(`${API_URL}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    alert("Evento creado (id " + data.eventId + ")");

    // Limpiar formulario
    eventTitle.value = "";
    eventDescription.value = "";
    eventSharedWith.value = "";
    eventRecurrence.value = "NONE";
    setDefaultEventDateTime(selectedDate);

    // Recargar eventos del día
    loadEventsForDate(formatDateYYYYMMDD(selectedDate));
  } catch (err) {
    console.error("Error al crear evento:", err);
    alert("Error al crear el evento");
  }
});

// === Inicialización ===

// Fecha seleccionada = hoy
selectedDate = new Date();
viewDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
currentDateInput.value = formatDateYYYYMMDD(selectedDate);
updateSelectedDateLabel();
renderCalendar();
initUserFromStorage();
