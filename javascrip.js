const STORAGE_KEY = "sia-espinar-demo-v1";
const SESSION_KEY = "sia-espinar-session-v1";
const app = document.querySelector("#app");

const createInitialData = () => ({
  currentPeriod: "2026-II",
  users: [
    { id: "admin-demo", dni: "00000000", name: "Administrador Demo", email: "admin@iestpespinar.edu.pe", password: "Admin123!", role: "admin", career: "Administración del sistema" },
    { id: "student-demo", dni: "00000001", name: "Estudiante Demo", email: "estudiante@iestpespinar.edu.pe", password: "00000001", role: "student", career: "Arquitectura de Plataformas y Servicios de Tecnologías de Información" }
  ],
  courses: [
    { id: "course-demo", name: "Desarrollo de aplicaciones", semester: "IV", credits: 4, period: "2026-II" }
  ],
  grades: [
    { id: "grade-demo", userId: "student-demo", courseId: "course-demo", period: "2026-II", grade: 14, attendance: "—" }
  ]
});

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    const initial = createInitialData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed.users) || !Array.isArray(parsed.courses) || !Array.isArray(parsed.grades)) {
      throw new Error("La estructura guardada no es válida.");
    }
    return parsed;
  } catch (error) {
    console.error("No se pudieron leer los datos locales del SIA.", error);
    app.innerHTML = `<main class="login-shell"><section class="login-card"><h1>No se pudieron cargar los datos</h1><p class="section-note">El almacenamiento local está dañado o no tiene el formato esperado. No se sobrescribió para evitar perder información.</p><button class="button button-primary" data-action="reset-storage">Restablecer demo</button></section></main>`;
    return null;
  }
}

let data = loadData();
let currentUser = null;
let page = "dashboard";
let editingStudentId = null;
let editingCourseId = null;
let editingGradeId = null;
let selectedGradeId = null;
let reportPeriod = "";
let reportStudentId = "";
let flashMessage = "";

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);
}

function initials(name) {
  return String(name || "").trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "U";
}

function findUser(id) { return data.users.find(user => user.id === id); }
function findCourse(id) { return data.courses.find(course => course.id === id); }
function studentGrades(userId, period) {
  return data.grades.filter(grade => grade.userId === userId && (!period || grade.period === period));
}
function partialGrades(grade) {
  if (Array.isArray(grade.evaluations) && grade.evaluations.length) {
    const partials = [1, 2, 3].map(partial => {
      const evaluations = grade.evaluations.filter(item => Number(item.partial) === partial);
      const totalWeight = evaluations.reduce((total, item) => total + Number(item.weight), 0);
      return {
        partial,
        evaluations,
        score: totalWeight
          ? evaluations.reduce((total, item) => total + Number(item.score) * Number(item.weight), 0) / totalWeight
          : null
      };
    });
    return partials;
  }
  return [1, 2, 3].map(partial => ({
    partial,
    evaluations: [],
    score: null
  }));
}
function academicGrade(grade) {
  const scores = partialGrades(grade).map(partial => partial.score).filter(score => score !== null);
  return scores.length
    ? scores.reduce((total, score) => total + score, 0) / scores.length
    : Number(grade.grade);
}
function attendancePercentage(grade) {
  if (Array.isArray(grade.attendanceSessions) && grade.attendanceSessions.length) {
    const attended = grade.attendanceSessions.filter(session => session.status === "present").length;
    return attended / grade.attendanceSessions.length * 100;
  }
  const match = String(grade.attendance ?? "").trim().match(/^(\d+(?:[.,]\d+)?)\s*%?$/);
  if (!match) return null;
  const percentage = Number(match[1].replace(",", "."));
  return Number.isFinite(percentage) && percentage >= 0 && percentage <= 100 ? percentage : null;
}
function finalGrade(grade) {
  const attendance = attendancePercentage(grade);
  const academic = academicGrade(grade);
  return attendance === null ? academic : (academic + attendance * 0.2) / 2;
}
function attendanceLabel(grade) {
  const percentage = attendancePercentage(grade);
  return percentage === null ? "—" : `${percentage.toFixed(2)}%`;
}
function average(grades) {
  const credits = grades.reduce((total, grade) => total + Number(findCourse(grade.courseId)?.credits || 0), 0);
  return credits
    ? (grades.reduce((total, grade) => total + finalGrade(grade) * Number(findCourse(grade.courseId)?.credits || 0), 0) / credits).toFixed(2)
    : "—";
}
function gradeStatus(value) {
  return Number(value) >= 13
    ? '<span class="status status-approved">APROBADO</span>'
    : '<span class="status status-failed">DESAPROBADO</span>';
}
function showFlash(message) {
  flashMessage = message;
}
function renderFlash() {
  if (!flashMessage) return "";
  const message = escapeHtml(flashMessage);
  flashMessage = "";
  return `<div class="notice notice-success">${message}</div>`;
}

function passwordVisibilityButton(inputId) {
  return `<button class="password-visibility" type="button" data-action="toggle-password" data-target="${inputId}" aria-label="Mostrar contraseña" aria-pressed="false" title="Mostrar contraseña">
    <svg class="icon-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>
  </button>`;
}

function renderLogin() {
  if (!data) return;
  app.innerHTML = `
    <main class="login-shell">
      <div class="login-layout">
        <section class="login-intro" aria-label="Información institucional">
          <div class="login-institution">
            <img src="logo-iestp%20(1).png" alt="Escudo del IESTP Espinar">
            <div><strong>Instituto de Educación Superior Tecnológico Público - "Espinar"</strong></div>
          </div>
          <div class="login-intro-copy">
            <span class="login-eyebrow">PORTAL INSTITUCIONAL</span>
            <h1>Sistema de<br>Información Académica</h1>
            <p>Consulta tu información académica desde un espacio diseñado para acompañar tu formación.</p>
          </div>
          <div class="login-security"><span class="security-icon" aria-hidden="true">✓</span><span>Acceso para estudiantes y personal autorizado</span></div>
          <span class="login-decoration login-decoration-one" aria-hidden="true"></span>
          <span class="login-decoration login-decoration-two" aria-hidden="true"></span>
        </section>
        <section class="login-card">
          <div class="login-form-heading">
            <span class="login-form-icon" aria-hidden="true">↗</span>
            <span class="login-eyebrow">SIA</span>
            <h2>Iniciar sesión</h2>
            <p>Ingresa tus credenciales institucionales para continuar.</p>
          </div>
          ${flashMessage ? `<div class="notice notice-success">${escapeHtml(flashMessage)}</div>` : ""}
          <div id="login-error" class="notice notice-error hidden" role="alert"></div>
          <form id="login-form" novalidate>
            <div class="field"><label for="login-dni">DNI o usuario</label><input id="login-dni" name="dni" inputmode="numeric" autocomplete="username" placeholder="Escribe tu DNI o usuario" required maxlength="30"></div>
            <div class="field"><label for="login-password">Contraseña</label><div class="password-input"><input id="login-password" name="password" type="password" autocomplete="current-password" placeholder="Escribe tu contraseña" required minlength="6" maxlength="100">${passwordVisibilityButton("login-password")}</div></div>
            <button class="button button-primary button-block" type="submit">Ingresar al sistema <span aria-hidden="true">→</span></button>
          </form>
          <p class="login-help">¿No tienes acceso? Comunícate con el área de administración.</p>
          <div class="login-form-footer"><span aria-hidden="true">●</span> Instituto de Educación Superior Tecnológico Público - "Espinar"</div>
        </section>
      </div>
    </main>`;
  flashMessage = "";
}

const studentNavigation = [
  { section: "", items: [["dashboard", "🏠", "Panel principal"]] },
  { section: "Mi espacio", items: [["grades", "📝", "Mis notas"], ["report", "📄", "Reporte de notas"]] },
  { section: "Mi cuenta", items: [["password", "🔑", "Cambiar contraseña"], ["logout", "🚪", "Cerrar sesión"]] }
];
const adminNavigation = [
  { section: "Resumen", items: [["dashboard", "🏠", "Panel principal"]] },
  { section: "Gestión académica", items: [["students", "👥", "Estudiantes"], ["courses", "📚", "Cursos"], ["admin-grades", "📝", "Notas"], ["student-reports", "📄", "Reportes de notas"]] },
  { section: "Administración", items: [["settings", "⚙️", "Periodo académico"], ["logout", "🚪", "Cerrar sesión"]] }
];

function renderNavigation() {
  const groups = currentUser.role === "admin" ? adminNavigation : studentNavigation;
  return groups.map(group => `
    ${group.section ? `<div class="nav-section">${group.section}</div>` : ""}
    <div class="nav-list">${group.items.map(([id, icon, label]) => `
      <button class="nav-link ${page === id ? "active" : ""}" data-page="${id}">
        <span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>
      </button>`).join("")}</div>`).join("");
}

function shell(title, content) {
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-brand brand-lockup">
          <img src="logo-iestp%20(1).png" alt="">
          <div><strong>IESTP ESPINAR</strong><span>Sistema de Información Académica</span></div>
        </div>
        ${renderNavigation()}
      </aside>
      <button class="sidebar-backdrop" type="button" data-action="close-menu" aria-label="Cerrar menú"></button>
      <section class="main-area">
        <header class="topbar">
          <div style="display:flex;align-items:center;gap:11px"><button class="mobile-menu" data-action="toggle-menu" aria-label="Abrir menú">☰</button><h1>${escapeHtml(title)}</h1></div>
          <div class="topbar-actions">
            <span class="period-badge">Periodo vigente: ${escapeHtml(data.currentPeriod)}</span>
            ${currentUser.role === "student" ? `
              <div class="user-menu-container">
                <button class="user-menu-trigger" type="button" data-action="toggle-user-menu" aria-expanded="false">
                  <span class="avatar">${escapeHtml(initials(currentUser.name))}</span>
                  <span class="user-copy"><strong>${escapeHtml(currentUser.name)}</strong><span>Estudiante</span></span>
                  <span class="user-menu-caret" aria-hidden="true">⌄</span>
                </button>
                <div class="user-dropdown hidden" id="user-dropdown">
                  <button type="button" data-page="password"><span aria-hidden="true">🔑</span>Cambiar contraseña</button>
                  <button type="button" data-page="logout"><span aria-hidden="true">↪</span>Cerrar sesión</button>
                </div>
              </div>` : `
              <div class="user-menu"><span class="avatar">${escapeHtml(initials(currentUser.name))}</span><div class="user-copy"><strong>${escapeHtml(currentUser.name)}</strong><span>Administrador</span></div></div>`}
          </div>
        </header>
        <main class="content">${renderFlash()}${content}</main>
        <footer class="footer">SIA · Instituto de Educación Superior Tecnológico Público - "Espinar"</footer>
      </section>
    </div>`;
}

function heading(title, subtitle, action = "") {
  return `<div class="page-heading"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(subtitle)}</p></div>${action}</div>`;
}

function statCard(icon, value, label, color = "") {
  return `<article class="stat-card"><span class="stat-icon ${color}">${icon}</span><div><span class="stat-value">${escapeHtml(value)}</span><span class="stat-label">${escapeHtml(label)}</span></div></article>`;
}

function studentActionCard(icon, value, label, pageId, color = "") {
  return `<button class="stat-card stat-card-link" type="button" data-page="${pageId}">
    <span class="stat-icon ${color}" aria-hidden="true">${icon}</span>
    <span class="stat-copy"><strong class="stat-value">${escapeHtml(value)}</strong><span class="stat-label">${escapeHtml(label)}</span></span>
  </button>`;
}

function gradeRows(grades, includeStudent = false) {
  if (!grades.length) return `<tr><td class="empty-state" colspan="${includeStudent ? 7 : 6}">No hay notas registradas para este periodo.</td></tr>`;
  return grades.map(grade => {
    const course = findCourse(grade.courseId);
    const student = findUser(grade.userId);
    const score = finalGrade(grade);
    return `<tr>
      ${includeStudent ? `<td>${escapeHtml(student?.name || "Estudiante eliminado")}</td>` : ""}
      <td>${escapeHtml(course?.name || "Curso eliminado")}</td>
      <td class="text-center">${escapeHtml(course?.semester || "—")}</td>
      <td class="text-center">${escapeHtml(course?.credits ?? "—")}</td>
      <td class="text-center ${score < 13 ? "text-danger" : ""}">${score.toFixed(2)}</td>
      ${includeStudent ? `<td>${escapeHtml(grade.period)}</td>` : `<td class="text-center">${escapeHtml(attendanceLabel(grade))}</td>`}
      <td>${gradeStatus(score)}</td>
    </tr>`;
  }).join("");
}

function renderStudentCourses() {
  const grades = studentGrades(currentUser.id, null).sort((first, second) => second.period.localeCompare(first.period));
  return shell("Mis cursos", `
    ${heading("Mis cursos", `Cursos asociados a tu cuenta · periodo vigente ${data.currentPeriod}`)}
    <section class="panel">
      <div class="panel-heading"><h3>Mis unidades didácticas</h3><span class="muted">${grades.length} registros</span></div>
      <div class="table-wrap"><table><thead><tr><th>Unidad didáctica</th><th>Periodo académico</th><th class="text-center">Créditos</th><th>Periodo lectivo</th><th>Nota final</th><th>Estado</th></tr></thead><tbody>
        ${grades.length ? grades.map(grade => {
          const course = findCourse(grade.courseId);
          const score = finalGrade(grade);
          return `<tr><td>${escapeHtml(course?.name || "Curso eliminado")}</td><td>${escapeHtml(course?.semester || "—")}</td><td class="text-center">${escapeHtml(course?.credits ?? "—")}</td><td>${escapeHtml(grade.period)}</td><td class="text-center ${score < 13 ? "text-danger" : ""}">${score.toFixed(2)}</td><td>${gradeStatus(score)}</td></tr>`;
        }).join("") : `<tr><td class="empty-state" colspan="6">Todavía no tienes cursos asignados.</td></tr>`}
      </tbody></table></div>
    </section>`);
}

function renderStudentDashboard() {
  const grades = studentGrades(currentUser.id, data.currentPeriod);
  const courseRows = grades.length ? grades.map(grade => {
    const course = findCourse(grade.courseId);
    const score = finalGrade(grade);
    return `<tr>
      <td><button class="course-name-link" type="button" data-action="view-grade" data-id="${escapeHtml(grade.id)}">${escapeHtml(course?.name || "Curso eliminado")}</button></td>
      <td class="text-center">${escapeHtml(course?.credits ?? "—")}</td>
      <td class="text-center ${score < 13 ? "text-danger" : ""}">${score.toFixed(2)}</td>
      <td class="text-center">${escapeHtml(attendanceLabel(grade))}</td>
      <td>${gradeStatus(score)}</td>
    </tr>`;
  }).join("") : `<tr><td class="empty-state" colspan="5">Todavía no tienes cursos ni notas registradas para este periodo.</td></tr>`;
  return shell("Panel principal", `
    <div class="student-welcome">
      <h2>Hola, ${escapeHtml(currentUser.name)}</h2>
      <p>Periodo lectivo vigente: <strong>${escapeHtml(data.currentPeriod)}</strong></p>
    </div>
    <section class="stats-grid student-dashboard-cards">
      ${studentActionCard("📚", String(grades.length), `Cursos en ${data.currentPeriod}`, "courses")}
      ${studentActionCard("📈", average(grades), "Promedio ponderado", "grades", "green")}
    </section>
    <section class="panel student-current-courses">
      <div class="panel-heading"><h3>Mis cursos del periodo</h3></div>
      <div class="table-wrap"><table><thead><tr><th>Unidad didáctica</th><th class="text-center">Créditos</th><th class="text-center">Promedio</th><th class="text-center">Asistencia</th><th>Estado</th></tr></thead><tbody>
        ${courseRows}
      </tbody></table></div>
    </section>`);
}

function renderStudentGrades() {
  const grades = studentGrades(currentUser.id, null).sort((first, second) => second.period.localeCompare(first.period));
  const selectedGrade = grades.find(grade => grade.id === selectedGradeId);
  if (selectedGrade) return renderStudentGradeDetail(selectedGrade);
  const approvedCredits = grades.reduce((total, grade) => {
    if (finalGrade(grade) < 13) return total;
    return total + Number(findCourse(grade.courseId)?.credits || 0);
  }, 0);
  return shell("Mis notas", `
    ${heading("Mis notas", "Resumen de tu rendimiento académico. Selecciona una tarjeta para continuar.")}
    <section class="stats-grid student-grade-cards">
      ${studentActionCard("📈", average(grades), "Promedio acumulado", "report")}
      ${studentActionCard("🏅", String(approvedCredits), "Créditos aprobados", "courses", "green")}
      ${studentActionCard("📚", String(grades.length), "Unidades didácticas", "courses", "cyan")}
      ${studentActionCard("📄", "Reporte de notas", "Ver / descargar", "report", "gold")}
    </section>
    <section class="panel">
      <div class="panel-heading"><h3>Notas por unidad didáctica</h3><span class="muted">${grades.length} registros</span></div>
      <div class="table-wrap"><table><thead><tr><th>Unidad didáctica</th><th>Periodo</th><th class="text-center">Créditos</th><th class="text-center">Nota final</th><th>Estado</th></tr></thead><tbody>
        ${grades.length ? grades.map(grade => {
          const course = findCourse(grade.courseId);
          const score = finalGrade(grade);
          return `<tr><td><button class="course-name-link" type="button" data-action="view-grade" data-id="${escapeHtml(grade.id)}">${escapeHtml(course?.name || "Curso eliminado")}</button></td><td>${escapeHtml(grade.period)}</td><td class="text-center">${escapeHtml(course?.credits ?? "—")}</td><td class="text-center ${score < 13 ? "text-danger" : ""}">${score.toFixed(2)}</td><td>${gradeStatus(score)}</td></tr>`;
        }).join("") : `<tr><td class="empty-state" colspan="5">Todavía no tienes notas registradas.</td></tr>`}
      </tbody></table></div>
    </section>`);
}

function renderStudentGradeDetail(grade) {
  const course = findCourse(grade.courseId);
  const score = finalGrade(grade);
  const attendance = attendancePercentage(grade);
  const attendanceGrade = attendance === null ? null : attendance * 0.2;
  const partials = partialGrades(grade);
  const sessions = Array.isArray(grade.attendanceSessions) ? grade.attendanceSessions : [];
  const absences = sessions.filter(session => session.status === "absent").length;
  return shell("Mis notas", `
    <button class="grade-detail-back" type="button" data-action="all-grades">← Todas mis notas</button>
    <section class="grade-detail-summary">
      <div>
        <p class="grade-detail-meta">${escapeHtml(grade.period)} · Periodo académico ${escapeHtml(course?.semester || "—")} · ${escapeHtml(course?.credits ?? "—")} créditos</p>
        <h2>${escapeHtml(course?.name || "Unidad didáctica")}</h2>
      </div>
      <div class="grade-detail-result">
        <span>Nota final</span>
        <strong class="${score < 13 ? "text-danger" : ""}">${score.toFixed(2)}</strong>
        ${gradeStatus(score)}
      </div>
    </section>
    <section class="panel grade-detail-panel">
      <div class="panel-heading"><h3>Evaluaciones por parcial</h3><span class="muted">Nota académica: ${academicGrade(grade).toFixed(2)} / 20</span></div>
      <div class="grade-partials">${partials.map(({ partial, evaluations, score: partialScore }) => `
        <article class="grade-partial">
          <div class="grade-partial-heading"><h4>Parcial ${partial}</h4><strong>${partialScore === null ? "—" : `${partialScore.toFixed(2)} / 20`}</strong></div>
          ${evaluations.length ? evaluations.map(item => `
            <div class="grade-detail-row"><span>${escapeHtml(item.name)} <small>· ${Number(item.weight).toFixed(0)}%</small></span><strong>${Number(item.score).toFixed(2)}</strong></div>`).join("")
            : `<p class="grade-detail-empty">Aún sin evaluaciones registradas.</p>`}
        </article>`).join("")}</div>
    </section>
    <section class="panel grade-detail-panel grade-attendance-panel">
      <div class="panel-heading"><h3>Asistencia</h3><span class="muted">${absences} ${absences === 1 ? "falta" : "faltas"} · ${attendance === null ? "Sin registro" : `${attendance.toFixed(2)}%`}</span></div>
      ${sessions.length ? sessions.map(session => `
        <div class="grade-detail-row"><span>${escapeHtml(session.date)}</span><strong class="${session.status === "absent" ? "text-danger" : ""}">${session.status === "present" ? "Asistió" : "Falta"}</strong></div>`).join("")
        : `<p class="grade-detail-empty">${attendance === null ? "Aún no hay sesiones registradas." : `Registro anterior de asistencia: ${attendance.toFixed(2)}%`}</p>`}
      <div class="grade-detail-row"><span>Asistencia en escala 0–20</span><strong>${attendanceGrade === null ? "—" : `${attendanceGrade.toFixed(2)} / 20`}</strong></div>
      <div class="grade-detail-row grade-detail-total"><span>Promedio final</span><strong>${score.toFixed(2)} / 20</strong></div>
    </section>`);
}

function renderGradesReport(student, isAdmin = false) {
  const allGrades = studentGrades(student.id, null).sort((first, second) => second.period.localeCompare(first.period));
  const periods = [...new Set([data.currentPeriod, ...allGrades.map(grade => grade.period)])];
  const selectedPeriod = periods.includes(reportPeriod) ? reportPeriod : data.currentPeriod;
  const grades = studentGrades(student.id, selectedPeriod);
  const emittedAt = new Date().toLocaleString("es-PE", { dateStyle: "short", timeStyle: "short" });
  return shell("Reporte de notas", `
    ${heading(isAdmin ? "Reportes de notas" : "Reporte de notas", isAdmin ? "Consulta e imprime el informe académico de cada estudiante." : "Consulta e imprime tus calificaciones registradas.")}
    <div class="toolbar no-print">
      ${isAdmin ? `<div class="field"><label for="report-student">Estudiante</label><select id="report-student" name="reportStudent">
        ${data.users.filter(user => user.role === "student").map(user => `<option value="${escapeHtml(user.id)}" ${user.id === student.id ? "selected" : ""}>${escapeHtml(user.name)} · ${escapeHtml(user.dni)}</option>`).join("")}
      </select></div>` : ""}
      <div class="field"><label for="report-period">Periodo lectivo</label><select id="report-period" name="reportPeriod">
        ${periods.map(period => `<option value="${escapeHtml(period)}" ${period === selectedPeriod ? "selected" : ""}>${escapeHtml(period)}</option>`).join("")}
      </select></div>
      <button class="button button-primary" data-action="print">🖨️ Imprimir / Guardar PDF</button>
    </div>
    <section class="report-paper">
      <div class="report-header">
        <div class="report-institution"><img src="logo-iestp%20(1).png" alt="Escudo institucional"><div><strong>IESTP ESPINAR</strong><span>Sistema de Información Académica</span></div></div>
        <div class="report-emission"><span>Pág: 1 / 1</span><span>Fecha y hora de emisión: ${escapeHtml(emittedAt)}</span></div>
      </div>
      <h3 class="report-title">BOLETA DE NOTAS - PERIODO LECTIVO ${escapeHtml(selectedPeriod)}</h3>
      <section class="report-data-section">
        <h4>I. DATOS DE LA INSTITUCIÓN</h4>
        <table class="report-data-table"><tbody>
          <tr><td class="report-label">Nombre de la Institución:</td><td>ESPINAR</td><td class="report-label">Tipo Gestión:</td><td>PÚBLICO</td></tr>
          <tr><td class="report-label">Programa de Estudios:</td><td>${escapeHtml(student.career)}</td><td class="report-label">Plan de Estudios:</td><td>PLAN-2021</td></tr>
        </tbody></table>
      </section>
      <section class="report-data-section">
        <h4>II. INFORMACIÓN DEL ESTUDIANTE</h4>
        <table class="report-data-table"><tbody>
          <tr><td class="report-label">Apellidos y Nombres:</td><td>${escapeHtml(student.name)}</td><td class="report-label">Nro Documento:</td><td>${escapeHtml(student.dni)}</td></tr>
        </tbody></table>
      </section>
      <div class="table-wrap"><table class="report-grades-table"><thead><tr><th>Nro</th><th>Unidad didáctica</th><th>Periodo académico</th><th>Nota final</th></tr></thead><tbody>
        ${grades.length ? grades.map((grade, index) => {
          const course = findCourse(grade.courseId);
          return `<tr><td>${index + 1}</td><td>${escapeHtml(course?.name || "Curso eliminado").toUpperCase()}</td><td class="text-center">${escapeHtml(course?.semester || "—")}</td><td class="text-center">${finalGrade(grade).toFixed(2)}</td></tr>`;
        }).join("") : `<tr><td colspan="4" class="text-center">${isAdmin ? "Este estudiante aún no tiene notas registradas para este periodo." : "No tienes notas registradas para este periodo."}</td></tr>`}
      </tbody></table></div>
      <p class="report-footnote">Documento informativo generado por el Sistema de Información Académica del Instituto de Educación Superior Tecnológico Público "Espinar". Las notas oficiales son las registradas en el sistema institucional correspondiente.</p>
    </section>`);
}

function renderStudentReport() {
  return renderGradesReport(currentUser);
}

function renderStudentReports() {
  const students = data.users.filter(user => user.role === "student");
  const selectedStudent = students.find(student => student.id === reportStudentId) || students[0];
  if (!selectedStudent) {
    return shell("Reportes de notas", `
      ${heading("Reportes de notas", "Consulta e imprime el informe académico de cada estudiante.")}
      <section class="panel"><p class="empty-state">Registra un estudiante para consultar su reporte de notas.</p></section>`);
  }
  return renderGradesReport(selectedStudent, true);
}

function renderAdminDashboard() {
  const students = data.users.filter(user => user.role === "student");
  const grades = data.grades.filter(grade => grade.period === data.currentPeriod);
  const averages = grades.map(finalGrade);
  const averageAll = averages.length ? (averages.reduce((sum, value) => sum + value, 0) / averages.length).toFixed(2) : "—";
  return shell("Panel principal", `
    ${heading("Panel de administración", `Resumen académico · periodo ${data.currentPeriod}`)}
    <section class="stats-grid">
      ${statCard("👥", String(students.length), "Estudiantes registrados")}
      ${statCard("📚", String(data.courses.length), "Cursos disponibles", "green")}
      ${statCard("📝", String(grades.length), "Notas en el periodo", "cyan")}
      ${statCard("📈", averageAll, "Promedio general", "gold")}
    </section>
    <section class="panel"><div class="panel-heading"><h3>Actividad reciente del periodo</h3><button class="text-button" data-page="admin-grades">Gestionar notas →</button></div>
      <div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Unidad didáctica</th><th>Periodo académico</th><th>Nota final</th><th>Estado</th></tr></thead><tbody>
      ${grades.length ? grades.slice(-8).reverse().map(grade => {
        const student = findUser(grade.userId);
        const course = findCourse(grade.courseId);
        const score = finalGrade(grade);
        return `<tr><td>${escapeHtml(student?.name || "Estudiante eliminado")}</td><td>${escapeHtml(course?.name || "Curso eliminado")}</td><td>${escapeHtml(grade.period)}</td><td>${score.toFixed(2)}</td><td>${gradeStatus(score)}</td></tr>`;
      }).join("") : `<tr><td class="empty-state" colspan="5">Todavía no se registraron notas para este periodo.</td></tr>`}
      </tbody></table></div>
    </section>`);
}

function studentForm() {
  const student = editingStudentId ? findUser(editingStudentId) : null;
  return `<section class="panel"><div class="panel-heading"><h3>${student ? "Editar estudiante" : "Registrar estudiante"}</h3></div><div class="panel-body">
    <form id="student-form" data-id="${student ? escapeHtml(student.id) : ""}">
      <div class="form-grid">
        <div class="field"><label for="student-name">Nombres y apellidos</label><input id="student-name" name="name" required maxlength="90" value="${escapeHtml(student?.name || "")}"></div>
        <div class="field"><label for="student-dni">DNI</label><input id="student-dni" name="dni" inputmode="numeric" required pattern="[0-9]{8}" maxlength="8" value="${escapeHtml(student?.dni || "")}"></div>
        <div class="field"><label for="student-email">Correo</label><input id="student-email" name="email" type="email" required maxlength="120" value="${escapeHtml(student?.email || "")}"></div>
        <div class="field"><label for="student-career">Programa de estudios</label><input id="student-career" name="career" required maxlength="120" value="${escapeHtml(student?.career || "")}"></div>
        ${student ? "" : `<div class="field"><label for="student-password">Contraseña inicial</label><div class="password-input"><input id="student-password" name="password" type="password" required minlength="6" maxlength="100">${passwordVisibilityButton("student-password")}</div><small>El estudiante podrá cambiarla desde su cuenta.</small></div>`}
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">${student ? "Guardar cambios" : "Registrar estudiante"}</button>${student ? `<button class="button button-secondary" type="button" data-action="cancel-student-edit">Cancelar</button>` : ""}</div>
    </form>
  </div></section>`;
}

function renderStudents() {
  const students = data.users.filter(user => user.role === "student");
  return shell("Estudiantes", `
    ${heading("Estudiantes", "Registra y administra las cuentas de estudiantes.")}
    ${studentForm()}
    <section class="panel"><div class="panel-heading"><h3>Directorio de estudiantes</h3><span class="muted">${students.length} registros</span></div>
      <div class="table-wrap"><table><thead><tr><th>DNI</th><th>Nombre</th><th>Correo</th><th>Programa de estudios</th><th>Acciones</th></tr></thead><tbody>
      ${students.length ? students.map(student => `<tr><td>${escapeHtml(student.dni)}</td><td>${escapeHtml(student.name)}</td><td>${escapeHtml(student.email)}</td><td>${escapeHtml(student.career)}</td><td><div class="actions"><button class="button button-secondary button-small" data-action="edit-student" data-id="${escapeHtml(student.id)}">Editar</button><button class="button button-danger button-small" data-action="delete-student" data-id="${escapeHtml(student.id)}">Eliminar</button></div></td></tr>`).join("") : `<tr><td class="empty-state" colspan="5">Aún no hay estudiantes registrados.</td></tr>`}
      </tbody></table></div>
    </section>`);
}

function courseForm() {
  const course = editingCourseId ? findCourse(editingCourseId) : null;
  return `<section class="panel"><div class="panel-heading"><h3>${course ? "Editar curso" : "Agregar curso"}</h3></div><div class="panel-body">
    <form id="course-form" data-id="${course ? escapeHtml(course.id) : ""}">
      <div class="form-grid">
        <div class="field"><label for="course-name">Nombre de unidad didáctica</label><input id="course-name" name="name" required maxlength="100" value="${escapeHtml(course?.name || "")}"></div>
        <div class="field"><label for="course-semester">Periodo académico / ciclo</label><input id="course-semester" name="semester" required maxlength="20" placeholder="Ej. IV" value="${escapeHtml(course?.semester || "")}"></div>
        <div class="field"><label for="course-credits">Créditos</label><input id="course-credits" name="credits" type="number" min="1" max="30" required value="${escapeHtml(course?.credits || 4)}"></div>
        <div class="field"><label for="course-period">Periodo lectivo</label><input id="course-period" name="period" required pattern="[0-9]{4}-(I|II)" value="${escapeHtml(course?.period || data.currentPeriod)}"><small>Formato esperado: 2026-I o 2026-II.</small></div>
      </div>
      <div class="form-actions"><button class="button button-primary" type="submit">${course ? "Guardar cambios" : "Agregar curso"}</button>${course ? `<button class="button button-secondary" type="button" data-action="cancel-course-edit">Cancelar</button>` : ""}</div>
    </form>
  </div></section>`;
}

function renderCourses() {
  return shell("Cursos", `
    ${heading("Cursos", "Administra las unidades didácticas que estarán disponibles para el registro de notas.")}
    ${courseForm()}
    <section class="panel"><div class="panel-heading"><h3>Unidades didácticas</h3><span class="muted">${data.courses.length} registros</span></div>
      <div class="table-wrap"><table><thead><tr><th>Unidad didáctica</th><th>Ciclo</th><th>Créditos</th><th>Periodo lectivo</th><th>Acciones</th></tr></thead><tbody>
      ${data.courses.length ? data.courses.map(course => `<tr><td>${escapeHtml(course.name)}</td><td>${escapeHtml(course.semester)}</td><td>${escapeHtml(course.credits)}</td><td>${escapeHtml(course.period)}</td><td><div class="actions"><button class="button button-secondary button-small" data-action="edit-course" data-id="${escapeHtml(course.id)}">Editar</button><button class="button button-danger button-small" data-action="delete-course" data-id="${escapeHtml(course.id)}">Eliminar</button></div></td></tr>`).join("") : `<tr><td class="empty-state" colspan="5">Aún no hay cursos registrados.</td></tr>`}
      </tbody></table></div>
    </section>`);
}

function gradeEvaluationField(partial, item = {}) {
  return `<div class="grade-editor-row evaluation-row" data-partial="${partial}">
    <input type="text" data-evaluation-name aria-label="Nombre de evaluación" placeholder="Ej. Práctica calificada" value="${escapeHtml(item.name || "")}">
    <input type="number" data-evaluation-weight aria-label="Peso porcentual" min="1" max="100" step="1" placeholder="Peso %" value="${escapeHtml(item.weight ?? "")}">
    <input type="number" data-evaluation-score aria-label="Nota de evaluación" min="0" max="20" step="0.01" placeholder="Nota / 20" value="${escapeHtml(item.score ?? "")}">
    <button class="button button-danger button-small" type="button" data-action="remove-grade-row" aria-label="Quitar evaluación">Quitar</button>
  </div>`;
}
function gradeAttendanceField(session = {}) {
  return `<div class="grade-editor-row attendance-session-row">
    <input type="date" data-session-date aria-label="Fecha de sesión" value="${escapeHtml(session.date || "")}">
    <select data-session-status aria-label="Estado de asistencia"><option value="">Marca asistencia</option><option value="present" ${session.status === "present" ? "selected" : ""}>Asistió</option><option value="absent" ${session.status === "absent" ? "selected" : ""}>Falta</option></select>
    <button class="button button-danger button-small" type="button" data-action="remove-grade-row" aria-label="Quitar sesión">Quitar</button>
  </div>`;
}

function gradeForm() {
  const grade = editingGradeId ? data.grades.find(item => item.id === editingGradeId) : null;
  const students = data.users.filter(user => user.role === "student");
  let evaluations = Array.isArray(grade?.evaluations) ? grade.evaluations : [];
  if (grade && !evaluations.length && Number.isFinite(Number(grade.grade))) {
    evaluations = [{ partial: 1, name: "Nota académica", weight: 100, score: Number(grade.grade) }];
  }
  const sessions = Array.isArray(grade?.attendanceSessions) ? grade.attendanceSessions : [];
  return `<section class="panel"><div class="panel-heading"><h3>${grade ? "Editar nota" : "Registrar nota"}</h3></div><div class="panel-body">
    ${!students.length || !data.courses.length ? `<p class="section-note">Primero registra al menos un estudiante y un curso para poder ingresar notas.</p>` : ""}
    <form id="grade-form" data-id="${grade ? escapeHtml(grade.id) : ""}">
      <div class="form-grid">
        <div class="field"><label for="grade-student">Estudiante</label><select id="grade-student" name="userId" required><option value="">Selecciona un estudiante</option>${students.map(student => `<option value="${escapeHtml(student.id)}" ${student.id === grade?.userId ? "selected" : ""}>${escapeHtml(student.name)} · ${escapeHtml(student.dni)}</option>`).join("")}</select></div>
        <div class="field"><label for="grade-course">Unidad didáctica</label><select id="grade-course" name="courseId" required><option value="">Selecciona un curso</option>${data.courses.map(course => `<option value="${escapeHtml(course.id)}" ${course.id === grade?.courseId ? "selected" : ""}>${escapeHtml(course.name)} · ${escapeHtml(course.period)}</option>`).join("")}</select></div>
        <div class="field"><label for="grade-period">Periodo lectivo</label><input id="grade-period" name="period" required pattern="[0-9]{4}-(I|II)" value="${escapeHtml(grade?.period || data.currentPeriod)}"></div>
      </div>
      <div class="grade-editor-section">
        <div class="grade-editor-section-heading"><div><h4>Evaluaciones</h4><small>La nota de cada parcial usa el promedio ponderado de sus evaluaciones.</small></div></div>
        ${[1, 2, 3].map(partial => {
          const partialItems = evaluations.filter(item => Number(item.partial) === partial);
          return `<section class="grade-editor-partial"><div class="grade-editor-section-heading"><h5>Parcial ${partial}</h5><button class="button button-secondary button-small" type="button" data-action="add-evaluation" data-partial="${partial}">Agregar evaluación</button></div>
            <div class="grade-evaluation-list" data-partial-list="${partial}">${(partialItems.length ? partialItems : [{}]).map(item => gradeEvaluationField(partial, item)).join("")}</div>
          </section>`;
        }).join("")}
      </div>
      <div class="grade-editor-section">
        <div class="grade-editor-section-heading"><div><h4>Sesiones de asistencia</h4><small>El porcentaje se calcula con las sesiones registradas.</small></div><button class="button button-secondary button-small" type="button" data-action="add-attendance-session">Agregar sesión</button></div>
        <div class="grade-attendance-list">${(sessions.length ? sessions : [{}]).map(gradeAttendanceField).join("")}</div>
        ${grade && !sessions.length && attendancePercentage(grade) !== null ? `<p class="section-note">Este registro conserva la asistencia previa del ${attendancePercentage(grade).toFixed(2)}% hasta que ingreses sesiones.</p>` : ""}
      </div>
      <p class="section-note">La nota final es el promedio de la nota académica y la asistencia convertida a escala 0–20. Ejemplo: nota 14 y asistencia 60% = nota final 13.</p>
      <div class="form-actions"><button class="button button-primary" type="submit" ${!students.length || !data.courses.length ? "disabled" : ""}>${grade ? "Guardar nota" : "Registrar nota"}</button>${grade ? `<button class="button button-secondary" type="button" data-action="cancel-grade-edit">Cancelar</button>` : ""}</div>
    </form>
  </div></section>`;
}

function renderAdminGrades() {
  const grades = data.grades.slice().sort((first, second) => second.period.localeCompare(first.period));
  return shell("Gestión de notas", `
    ${heading("Gestión de notas", "Ingresa, corrige y consulta las calificaciones de los estudiantes.")}
    ${gradeForm()}
    <section class="panel"><div class="panel-heading"><h3>Notas registradas</h3><span class="muted">${grades.length} registros</span></div>
      <div class="table-wrap"><table><thead><tr><th>Estudiante</th><th>Unidad didáctica</th><th>Ciclo</th><th>Nota final</th><th>Asistencia</th><th>Periodo lectivo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
      ${grades.length ? grades.map(grade => {
        const student = findUser(grade.userId);
        const course = findCourse(grade.courseId);
        const score = finalGrade(grade);
        return `<tr><td>${escapeHtml(student?.name || "Estudiante eliminado")}</td><td>${escapeHtml(course?.name || "Curso eliminado")}</td><td>${escapeHtml(course?.semester || "—")}</td><td class="${score < 13 ? "text-danger" : ""}">${score.toFixed(2)}</td><td>${escapeHtml(attendanceLabel(grade))}</td><td>${escapeHtml(grade.period)}</td><td>${gradeStatus(score)}</td><td><div class="actions"><button class="button button-secondary button-small" data-action="edit-grade" data-id="${escapeHtml(grade.id)}">Editar</button><button class="button button-danger button-small" data-action="delete-grade" data-id="${escapeHtml(grade.id)}">Eliminar</button></div></td></tr>`;
      }).join("") : `<tr><td class="empty-state" colspan="8">Aún no hay notas registradas.</td></tr>`}
      </tbody></table></div>
    </section>`);
}

function renderSettings() {
  return shell("Periodo académico", `
    ${heading("Configuración académica", "Establece el periodo lectivo que se mostrará como vigente en el sistema.")}
    <section class="panel" style="max-width:600px"><div class="panel-heading"><h3>Periodo vigente</h3></div><div class="panel-body">
      <p class="section-note">El cambio de periodo no modifica ni elimina las notas existentes. El formato debe ser año y semestre, por ejemplo: 2026-II.</p>
      <form id="period-form"><div class="field"><label for="current-period">Periodo lectivo vigente</label><input id="current-period" name="period" required pattern="[0-9]{4}-(I|II)" value="${escapeHtml(data.currentPeriod)}"></div>
      <button class="button button-primary" type="submit">Guardar periodo</button></form>
    </div></section>`);
}

function renderPasswordSettings() {
  return shell("Cambiar contraseña", `
    ${heading("Cambiar contraseña", "Actualiza la contraseña de acceso de tu cuenta.")}
    <section class="panel password-panel">
      <div class="panel-heading"><h3>Seguridad de la cuenta</h3></div>
      <div class="panel-body">
        <form id="password-form">
          <div class="field"><label for="current-password">Contraseña actual</label><div class="password-input"><input id="current-password" name="currentPassword" type="password" autocomplete="current-password" required minlength="6" maxlength="100">${passwordVisibilityButton("current-password")}</div></div>
          <div class="field"><label for="new-password">Nueva contraseña</label><div class="password-input"><input id="new-password" name="newPassword" type="password" autocomplete="new-password" required minlength="6" maxlength="100">${passwordVisibilityButton("new-password")}</div><small>Debe tener al menos 6 caracteres.</small></div>
          <div class="field"><label for="password-repeat">Confirmar nueva contraseña</label><div class="password-input"><input id="password-repeat" name="passwordRepeat" type="password" autocomplete="new-password" required minlength="6" maxlength="100">${passwordVisibilityButton("password-repeat")}</div></div>
          <div class="form-actions"><button class="button button-primary" type="submit">Guardar nueva contraseña</button></div>
        </form>
      </div>
    </section>`);
}

function renderApp() {
  if (!data) return;
  if (!currentUser) {
    renderLogin();
    return;
  }
  if (currentUser.role === "admin") {
    const pages = {
      dashboard: renderAdminDashboard,
      students: renderStudents,
      courses: renderCourses,
      "admin-grades": renderAdminGrades,
      "student-reports": renderStudentReports,
      settings: renderSettings
    };
    (pages[page] || renderAdminDashboard)();
    return;
  }
  const pages = {
    dashboard: renderStudentDashboard,
    courses: renderStudentCourses,
    grades: renderStudentGrades,
    report: renderStudentReport,
    password: renderPasswordSettings
  };
  (pages[page] || renderStudentDashboard)();
}

function formData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function showFormError(message) {
  const error = document.querySelector("#login-error");
  if (error) {
    error.textContent = message;
    error.classList.remove("hidden");
  } else {
    showFlash(message);
    renderApp();
  }
}

app.addEventListener("click", event => {
  const target = event.target.closest("[data-action], [data-page]");
  if (!target) {
    document.querySelector("#user-dropdown")?.classList.add("hidden");
    document.querySelector(".user-menu-trigger")?.setAttribute("aria-expanded", "false");
    return;
  }
  if (target.dataset.action === "toggle-user-menu") {
    const dropdown = document.querySelector("#user-dropdown");
    const isOpen = dropdown?.classList.toggle("hidden") === false;
    target.setAttribute("aria-expanded", String(isOpen));
    return;
  }
  if (target.dataset.page) {
    if (target.dataset.page === "logout") {
      currentUser = null;
      localStorage.removeItem(SESSION_KEY);
      page = "dashboard";
      renderApp();
      return;
    }
    const allowedPages = currentUser.role === "admin"
      ? ["dashboard", "students", "courses", "admin-grades", "student-reports", "settings"]
      : ["dashboard", "courses", "grades", "report", "password"];
    if (!allowedPages.includes(target.dataset.page)) return;
    page = target.dataset.page;
    selectedGradeId = null;
    const sidebar = document.querySelector("#sidebar");
    if (sidebar) sidebar.classList.remove("open");
    renderApp();
    return;
  }
  const { action, id } = target.dataset;
  if (action === "view-grade") {
    const grade = data.grades.find(item => item.id === id && item.userId === currentUser?.id);
    if (!grade) return;
    selectedGradeId = grade.id;
    page = "grades";
    renderApp();
    return;
  }
  if (action === "all-grades") {
    selectedGradeId = null;
    page = "grades";
    renderApp();
    return;
  }
  if (action === "print") { window.print(); return; }
  if (action === "toggle-password") {
    const input = document.getElementById(target.dataset.target);
    if (!(input instanceof HTMLInputElement)) return;
    const showPassword = input.type === "password";
    input.type = showPassword ? "text" : "password";
    target.setAttribute("aria-label", showPassword ? "Ocultar contraseña" : "Mostrar contraseña");
    target.setAttribute("title", showPassword ? "Ocultar contraseña" : "Mostrar contraseña");
    target.setAttribute("aria-pressed", String(showPassword));
    target.innerHTML = showPassword
      ? `<svg class="icon-eye icon-eye-off" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"></path><path d="M10.6 5.1A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a15.8 15.8 0 0 1-3 3.8M6.2 6.2C3.5 8.1 2 12 2 12s3.6 7 10 7c1.4 0 2.7-.4 3.8-1"></path><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"></path></svg>`
      : `<svg class="icon-eye" viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
    return;
  }
  if (action === "toggle-menu") { document.querySelector("#sidebar")?.classList.toggle("open"); return; }
  if (action === "close-menu") { document.querySelector("#sidebar")?.classList.remove("open"); return; }
  if (action === "logout") { currentUser = null; localStorage.removeItem(SESSION_KEY); page = "dashboard"; renderApp(); return; }
  if (action === "cancel-student-edit") { editingStudentId = null; renderApp(); return; }
  if (action === "cancel-course-edit") { editingCourseId = null; renderApp(); return; }
  if (action === "cancel-grade-edit") { editingGradeId = null; renderApp(); return; }
  if (action === "edit-student") { editingStudentId = id; renderApp(); return; }
  if (action === "edit-course") { editingCourseId = id; renderApp(); return; }
  if (action === "edit-grade") { editingGradeId = id; renderApp(); return; }
  if (action === "add-evaluation") {
    const list = document.querySelector(`[data-partial-list="${target.dataset.partial}"]`);
    if (list) list.insertAdjacentHTML("beforeend", gradeEvaluationField(target.dataset.partial));
    return;
  }
  if (action === "add-attendance-session") {
    document.querySelector(".grade-attendance-list")?.insertAdjacentHTML("beforeend", gradeAttendanceField());
    return;
  }
  if (action === "remove-grade-row") {
    const row = target.closest(".grade-editor-row");
    const list = row?.parentElement;
    if (!row || !list) return;
    if (list.children.length > 1) row.remove();
    else row.querySelectorAll("input").forEach(input => { input.value = ""; });
    if (list.children.length === 1) {
      const select = list.querySelector("select");
      if (select) select.value = "";
    }
    return;
  }
  if (action === "delete-student") {
    const student = findUser(id);
    if (!student || !window.confirm(`¿Eliminar la cuenta de ${student.name} y todas sus notas?`)) return;
    data.users = data.users.filter(user => user.id !== id);
    data.grades = data.grades.filter(grade => grade.userId !== id);
    persist(); showFlash("Estudiante y sus notas eliminados."); renderApp(); return;
  }
  if (action === "delete-course") {
    const course = findCourse(id);
    if (!course || !window.confirm(`¿Eliminar el curso ${course.name} y sus notas asociadas?`)) return;
    data.courses = data.courses.filter(item => item.id !== id);
    data.grades = data.grades.filter(grade => grade.courseId !== id);
    persist(); showFlash("Curso y notas asociadas eliminados."); renderApp(); return;
  }
  if (action === "delete-grade") {
    if (!window.confirm("¿Eliminar este registro de nota?")) return;
    data.grades = data.grades.filter(grade => grade.id !== id);
    persist(); showFlash("Nota eliminada."); renderApp();
  }
  if (action === "reset-storage") {
    if (!window.confirm("Esto reemplazará los datos locales de la demo por los datos de ejemplo. ¿Continuar?")) return;
    data = createInitialData(); persist(); currentUser = null; renderApp();
  }
});

app.addEventListener("change", event => {
  if (event.target.id === "report-student") {
    reportStudentId = event.target.value;
    reportPeriod = "";
    renderApp();
  }
  if (event.target.id === "report-period") {
    reportPeriod = event.target.value;
    renderApp();
  }
});

app.addEventListener("submit", event => {
  event.preventDefault();
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  const values = formData(form);

  if (form.id === "login-form") {
    if (!form.reportValidity()) return;
    const user = data.users.find(item => item.dni === values.dni && item.password === values.password);
    if (!user) { showFormError("DNI o contraseña incorrectos."); return; }
    currentUser = user; localStorage.setItem(SESSION_KEY, user.id); page = "dashboard"; renderApp(); return;
  }

  if (form.id === "student-form") {
    if (!form.reportValidity()) return;
    if (data.users.some(user => user.dni === values.dni && user.id !== form.dataset.id)) { showFlash("Ya existe una cuenta con ese DNI."); renderApp(); return; }
    if (form.dataset.id) {
      const student = findUser(form.dataset.id);
      Object.assign(student, { name: values.name.trim(), dni: values.dni, email: values.email.trim(), career: values.career.trim() });
      editingStudentId = null;
      showFlash("Datos del estudiante actualizados.");
    } else {
      data.users.push({ id: crypto.randomUUID(), dni: values.dni, name: values.name.trim(), email: values.email.trim(), career: values.career.trim(), password: values.password, role: "student" });
      showFlash("Estudiante registrado correctamente.");
    }
    persist(); renderApp(); return;
  }

  if (form.id === "course-form") {
    if (!form.reportValidity()) return;
    const duplicate = data.courses.some(course => course.name.toLowerCase() === values.name.trim().toLowerCase() && course.period === values.period && course.id !== form.dataset.id);
    if (duplicate) { showFlash("Ya existe un curso con ese nombre en el mismo periodo lectivo."); renderApp(); return; }
    const courseValues = { name: values.name.trim(), semester: values.semester.trim(), credits: Number(values.credits), period: values.period };
    if (form.dataset.id) {
      Object.assign(findCourse(form.dataset.id), courseValues); editingCourseId = null; showFlash("Curso actualizado.");
    } else {
      data.courses.push({ id: crypto.randomUUID(), ...courseValues }); showFlash("Curso agregado correctamente.");
    }
    persist(); renderApp(); return;
  }

  if (form.id === "grade-form") {
    const evaluationRows = [...form.querySelectorAll(".evaluation-row")];
    const evaluations = [];
    evaluationRows.forEach(row => {
      const name = row.querySelector("[data-evaluation-name]");
      const weight = row.querySelector("[data-evaluation-weight]");
      const score = row.querySelector("[data-evaluation-score]");
      [name, weight, score].forEach(input => input.setCustomValidity(""));
      const values = [name.value.trim(), weight.value, score.value];
      if (values.every(value => !value)) return;
      if (!values[0]) name.setCustomValidity("Escribe el nombre de la evaluación.");
      else if (!values[1]) weight.setCustomValidity("Indica el peso de la evaluación.");
      else if (!values[2]) score.setCustomValidity("Indica la nota de la evaluación.");
      if (values.some(value => !value)) return;
      evaluations.push({
        partial: Number(row.dataset.partial),
        name: name.value.trim(),
        weight: Number(weight.value),
        score: Number(score.value)
      });
    });
    const sessionRows = [...form.querySelectorAll(".attendance-session-row")];
    const attendanceSessions = [];
    sessionRows.forEach(row => {
      const date = row.querySelector("[data-session-date]");
      const status = row.querySelector("[data-session-status]");
      date.setCustomValidity("");
      status.setCustomValidity("");
      if (!date.value && !status.value) return;
      if (!date.value) date.setCustomValidity("Indica la fecha de la sesión.");
      else if (!status.value) status.setCustomValidity("Marca si el estudiante asistió o faltó.");
      if (!date.value || !status.value) return;
      attendanceSessions.push({ date: date.value, status: status.value });
    });
    if (!evaluations.length) {
      const firstName = form.querySelector("[data-evaluation-name]");
      firstName.setCustomValidity("Registra al menos una evaluación.");
    }
    if (!form.reportValidity()) return;
    const duplicate = data.grades.some(grade => grade.userId === values.userId && grade.courseId === values.courseId && grade.period === values.period && grade.id !== form.dataset.id);
    if (duplicate) { showFlash("Ya existe una nota para este estudiante, curso y periodo."); renderApp(); return; }
    const previousGrade = data.grades.find(grade => grade.id === form.dataset.id);
    const academic = academicGrade({ evaluations });
    const gradeValues = {
      userId: values.userId,
      courseId: values.courseId,
      period: values.period,
      grade: academic,
      evaluations,
      attendanceSessions,
      attendance: attendanceSessions.length ? null : (previousGrade && !Array.isArray(previousGrade.attendanceSessions) ? previousGrade.attendance : null)
    };
    if (form.dataset.id) {
      Object.assign(data.grades.find(grade => grade.id === form.dataset.id), gradeValues); editingGradeId = null; showFlash("Nota actualizada.");
    } else {
      data.grades.push({ id: crypto.randomUUID(), ...gradeValues }); showFlash("Nota registrada correctamente.");
    }
    persist(); renderApp(); return;
  }

  if (form.id === "period-form") {
    if (!form.reportValidity()) return;
    data.currentPeriod = values.period;
    persist(); showFlash("Periodo vigente actualizado."); renderApp(); return;
  }

  if (form.id === "password-form") {
    if (!form.reportValidity()) return;
    if (values.currentPassword !== currentUser.password) { showFlash("La contraseña actual no es correcta."); renderApp(); return; }
    if (values.newPassword !== values.passwordRepeat) { showFlash("Las nuevas contraseñas no coinciden."); renderApp(); return; }
    if (values.newPassword === values.currentPassword) { showFlash("La nueva contraseña debe ser diferente a la actual."); renderApp(); return; }
    currentUser.password = values.newPassword;
    persist(); showFlash("Contraseña actualizada correctamente."); renderApp();
  }
});

if (data) {
  const sessionId = localStorage.getItem(SESSION_KEY);
  currentUser = sessionId ? findUser(sessionId) || null : null;
  if (currentUser?.role === "student") page = "dashboard";
  renderApp();
}

window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try {
    const updated = JSON.parse(event.newValue);
    if (!Array.isArray(updated.users) || !Array.isArray(updated.courses) || !Array.isArray(updated.grades)) {
      throw new Error("La estructura guardada no es válida.");
    }
    data = updated;
    currentUser = currentUser ? findUser(currentUser.id) || null : null;
    if (currentUser) renderApp();
  } catch (error) {
    console.error("No se pudieron actualizar los datos del SIA desde otra pestaña.", error);
  }
});