/* ══════════════════════════════════════════════════════════
   Faust Lernapp · app.js
   ──────────────────────────────────────────────────────────
   Archivo principal de JavaScript para la aplicación.
   Contiene toda la lógica de navegación, carga de datos
   y funcionamiento de los ejercicios.
   ══════════════════════════════════════════════════════════ */


/* ──────────────────────────────────────────────────────────
   FUNCIONES UTILITARIAS
   Pequeñas funciones de apoyo que se usan en todo el archivo.
   ────────────────────────────────────────────────────────── */

/**
 * Obtiene el valor de un parámetro de la URL.
 * Por ejemplo, en la URL "books.html?author=goethe",
 * getParam('author') devuelve la cadena "goethe".
 *
 * @param {string} name - Nombre del parámetro a buscar.
 * @returns {string|null} El valor del parámetro, o null si no existe.
 */
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/**
 * Carga un archivo JSON desde el servidor de forma asíncrona.
 * Si la petición falla (archivo no encontrado, error de red, etc.),
 * lanza un error para que pueda ser capturado con try/catch.
 *
 * @param {string} path - Ruta relativa al archivo JSON (ej: 'data/authors.json').
 * @returns {Promise<any>} Los datos del JSON ya convertidos a objeto JavaScript.
 */
async function fetchJSON(path) {
  const res = await fetch(path);
  // Si el servidor responde con un código de error (404, 500, etc.), lanzamos el error manualmente
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  return res.json();
}

/**
 * Normaliza una cadena de texto para comparar respuestas de forma flexible.
 * Convierte a minúsculas, elimina espacios al inicio y al final,
 * y reemplaza caracteres especiales alemanes por sus equivalentes básicos.
 * Esto permite que el usuario escriba "ue" en vez de "ü", por ejemplo.
 *
 * @param {string} str - El texto a normalizar.
 * @returns {string} El texto normalizado.
 */
function normalize(str) {
  return str.trim().toLowerCase()
    .replace(/ä/g, 'ae')   // ä → ae
    .replace(/ö/g, 'oe')   // ö → oe
    .replace(/ü/g, 'ue')   // ü → ue
    .replace(/ß/g, 'ss');  // ß → ss
}

/**
 * Compara la respuesta del usuario con la respuesta correcta.
 * Primero intenta con normalización (acepta variantes sin umlauts),
 * y si no coincide, intenta una comparación directa en minúsculas.
 * Devuelve true si la respuesta es correcta, false si no.
 *
 * @param {string} a - Respuesta del usuario.
 * @param {string} b - Respuesta correcta.
 * @returns {boolean}
 */
function answersMatch(a, b) {
  return normalize(a) === normalize(b) ||
         a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Construye y muestra la barra de navegación (breadcrumb) en el encabezado.
 * Recibe un array de objetos con { label, href } y genera los enlaces.
 * El último elemento se muestra como texto plano (página actual, sin enlace).
 *
 * @param {Array<{label: string, href: string}>} items - Lista de secciones del breadcrumb.
 */
function setBreadcrumb(items) {
  const el = document.getElementById('breadcrumb');
  if (!el) return; // Si no existe el elemento en el HTML, no hace nada

  el.innerHTML = items.map((item, i) => {
    // El último elemento es la página actual: se muestra sin enlace
    if (i === items.length - 1)
      return `<span class="current">${item.label}</span>`;
    // Los demás elementos son enlaces clicables seguidos de un separador "›"
    return `<a href="${item.href}">${item.label}</a>
            <span class="sep">›</span>`;
  }).join('');
}


/* ══════════════════════════════════════════════════════════
   PÁGINA: INDEX (index.html)
   Muestra la lista de autores disponibles.
   ══════════════════════════════════════════════════════════ */

/**
 * Inicializa la página de inicio.
 * Carga el archivo authors.json y genera una tarjeta por cada autor.
 * Al hacer clic en una tarjeta, navega a books.html pasando el id del autor.
 */
async function initIndex() {
  // Buscamos el contenedor donde se insertarán las tarjetas de autores
  const container = document.getElementById('authors-container');
  if (!container) return; // Si no existe el contenedor, salimos

  // Mostramos un indicador de carga mientras se obtienen los datos
  container.innerHTML = '<div class="loading">Cargando autores</div>';

  // Establecemos el breadcrumb sólo con "Inicio" (estamos en la raíz)
  setBreadcrumb([{ label: 'Inicio', href: 'index.html' }]);

  try {
    // Cargamos la lista de autores desde el archivo JSON
    const authors = await fetchJSON('data/authors.json');

    // Limpiamos el mensaje de carga
    container.innerHTML = '';

    // Creamos una tarjeta HTML por cada autor encontrado
    authors.forEach(author => {
      const card = document.createElement('div');
      card.className = 'card';

      // Rellenamos la tarjeta con los datos del autor
      card.innerHTML = `
        <div class="card-initial">${author.portrait_initial}</div>
        <div class="card-title">${author.name}</div>
        <div class="card-meta">${author.years} · ${author.nationality}</div>
        <div class="card-desc">${author.bio}</div>
        <span class="card-arrow">→</span>
      `;

      // Al hacer clic, navegamos a la página de obras de ese autor
      card.addEventListener('click', () => {
        window.location.href = `books.html?author=${author.id}`;
      });

      // Añadimos la tarjeta al contenedor
      container.appendChild(card);
    });

  } catch (err) {
    // Si ocurre cualquier error al cargar o procesar, lo mostramos en pantalla
    container.innerHTML = `<div class="error-message">Error al cargar autores: ${err.message}</div>`;
  }
}


/* ══════════════════════════════════════════════════════════
   PÁGINA: BOOKS (books.html)
   Muestra las obras disponibles para un autor concreto.
   ══════════════════════════════════════════════════════════ */

/**
 * Inicializa la página de libros/obras.
 * Lee el parámetro "author" de la URL para saber qué autor mostrar.
 * Carga authors.json y books.json en paralelo para mayor eficiencia.
 * Filtra las obras que pertenecen al autor seleccionado y genera tarjetas.
 */
async function initBooks() {
  const container = document.getElementById('books-container');
  if (!container) return;

  // Leemos el id del autor desde la URL (ej: ?author=goethe)
  const authorId = getParam('author');

  // Si no hay id de autor en la URL, redirigimos al inicio
  if (!authorId) { window.location.href = 'index.html'; return; }

  container.innerHTML = '<div class="loading">Cargando obras</div>';

  try {
    // Cargamos ambos archivos JSON de forma simultánea con Promise.all
    // para no esperar uno tras otro (más rápido)
    const [authors, books] = await Promise.all([
      fetchJSON('data/authors.json'),
      fetchJSON('data/books.json')
    ]);

    // Buscamos el autor cuyo id coincide con el parámetro de la URL
    const author = authors.find(a => a.id === authorId);
    if (!author) throw new Error('Autor no encontrado');

    // Filtramos sólo las obras que pertenecen a este autor
    const authorBooks = books.filter(b => b.author_id === authorId);

    // Actualizamos el título y subtítulo de la página con el nombre del autor
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.textContent = author.name;
    if (subtitleEl) subtitleEl.textContent = `${author.years} · ${author.nationality}`;

    // Actualizamos el breadcrumb: Inicio > Nombre del autor
    setBreadcrumb([
      { label: 'Inicio', href: 'index.html' },
      { label: author.name, href: `books.html?author=${authorId}` }
    ]);

    // Limpiamos el mensaje de carga y generamos una tarjeta por cada obra
    container.innerHTML = '';
    authorBooks.forEach(book => {
      const card = document.createElement('div');
      card.className = 'card';

      card.innerHTML = `
        <div class="card-initial">${book.cover_initial}</div>
        <div class="card-title">${book.title}</div>
        <div class="card-meta">${book.year} · ${book.language}</div>
        <div class="card-desc">${book.description}</div>
        <span class="card-arrow">→</span>
      `;

      // Al hacer clic, navegamos a los niveles de esa obra
      card.addEventListener('click', () => {
        window.location.href = `levels.html?book=${book.id}`;
      });

      container.appendChild(card);
    });

    // Si el autor no tiene obras registradas, mostramos un mensaje informativo
    if (authorBooks.length === 0) {
      container.innerHTML = '<p class="loading">No hay obras disponibles para este autor.</p>';
    }

  } catch (err) {
    container.innerHTML = `<div class="error-message">Error: ${err.message}</div>`;
  }
}


/* ══════════════════════════════════════════════════════════
   PÁGINA: LEVELS (levels.html)
   Muestra los niveles de ejercicios disponibles para una obra.
   ══════════════════════════════════════════════════════════ */

/**
 * Inicializa la página de niveles.
 * Lee el parámetro "book" de la URL para saber qué obra mostrar.
 * Carga los tres archivos de datos en paralelo para construir
 * el breadcrumb completo (autor > obra > nivel).
 */
async function initLevels() {
  const container = document.getElementById('levels-container');
  if (!container) return;

  // Leemos el id de la obra desde la URL (ej: ?book=faust)
  const bookId = getParam('book');
  if (!bookId) { window.location.href = 'index.html'; return; }

  container.innerHTML = '<div class="loading">Cargando niveles</div>';

  try {
    // Cargamos los tres archivos en paralelo
    const [books, levels, authors] = await Promise.all([
      fetchJSON('data/books.json'),
      fetchJSON('data/levels.json'),
      fetchJSON('data/authors.json')
    ]);

    // Buscamos la obra correspondiente al id recibido
    const book = books.find(b => b.id === bookId);
    if (!book) throw new Error('Obra no encontrada');

    // Buscamos el autor de la obra (necesario para el breadcrumb)
    const author = authors.find(a => a.id === book.author_id);

    // Filtramos sólo los niveles que pertenecen a esta obra
    const bookLevels = levels.filter(l => l.book_id === bookId);

    // Actualizamos el título de la página con el nombre de la obra
    const titleEl = document.getElementById('page-title');
    const subtitleEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.textContent = book.title;
    if (subtitleEl) subtitleEl.textContent = book.subtitle || '';

    // Breadcrumb completo: Inicio > Autor > Obra
    setBreadcrumb([
      { label: 'Inicio', href: 'index.html' },
      { label: author ? author.name : 'Autor', href: `books.html?author=${book.author_id}` },
      { label: book.title, href: `levels.html?book=${bookId}` }
    ]);

    // Generamos una tarjeta por cada nivel disponible
    container.innerHTML = '';
    bookLevels.forEach(level => {
      const card = document.createElement('div');
      card.className = 'card level-card';

      card.innerHTML = `
        <div class="card-badge">${level.difficulty}</div>
        <div class="card-title">${level.title}</div>
        <div class="card-meta">${level.subtitle}</div>
        <div class="card-desc">${level.description}</div>
        <span class="card-arrow">→</span>
      `;

      // Al hacer clic, navegamos a los ejercicios de ese nivel
      card.addEventListener('click', () => {
        window.location.href = `exercise.html?level=${level.id}`;
      });

      container.appendChild(card);
    });

    // Mensaje si no hay niveles registrados para la obra
    if (bookLevels.length === 0) {
      container.innerHTML = '<p class="loading">No hay niveles disponibles para esta obra.</p>';
    }

  } catch (err) {
    container.innerHTML = `<div class="error-message">Error: ${err.message}</div>`;
  }
}


/* ══════════════════════════════════════════════════════════
   PÁGINA: EXERCISE (exercise.html)
   Núcleo de la aplicación. Gestiona el flujo completo
   de un nivel de ejercicios: mostrar versos, verificar
   respuestas, revelar pistas y mostrar notas lingüísticas.
   ══════════════════════════════════════════════════════════ */

/**
 * Inicializa la página de ejercicios.
 * Carga todos los datos necesarios, configura el estado inicial
 * y delega el renderizado de cada ejercicio a renderExercise().
 */
async function initExercise() {
  const wrapper = document.getElementById('exercise-wrapper');
  if (!wrapper) return;

  // Leemos el id del nivel desde la URL (ej: ?level=faust_zueignung_1)
  const levelId = getParam('level');
  if (!levelId) { window.location.href = 'index.html'; return; }

  wrapper.innerHTML = '<div class="loading">Cargando ejercicios</div>';

  try {
    // Cargamos los cuatro archivos JSON en paralelo
    const [data, levels, books, authors] = await Promise.all([
      fetchJSON('data/exercises.json'),
      fetchJSON('data/levels.json'),
      fetchJSON('data/books.json'),
      fetchJSON('data/authors.json')
    ]);

    // Verificamos que el archivo de ejercicios corresponde al nivel solicitado
    if (data.level_id !== levelId) throw new Error('Nivel no encontrado en ejercicios');

    // Buscamos los metadatos del nivel, obra y autor para el breadcrumb
    const level  = levels.find(l => l.id === levelId);
    const book   = books.find(b => level && b.id === level.book_id);
    const author = authors.find(a => book && a.id === book.author_id);

    // Breadcrumb completo: Inicio > Autor > Obra > Nivel
    setBreadcrumb([
      { label: 'Inicio', href: 'index.html' },
      { label: author ? author.name : 'Autor', href: `books.html?author=${book ? book.author_id : ''}` },
      { label: book ? book.title : 'Obra', href: `levels.html?book=${book ? book.id : ''}` },
      { label: level ? level.title : 'Nivel', href: `exercise.html?level=${levelId}` }
    ]);

    // ── Estado del nivel ─────────────────────────────────
    const exercises  = data.exercises; // Array con todos los ejercicios del nivel
    let currentIndex = 0;              // Índice del ejercicio actual (empieza en 0)
    let correctCount = 0;              // Contador de respuestas correctas acumuladas


    /* ────────────────────────────────────────────────────
       renderExercise(index)
       Dibuja el ejercicio en pantalla dado su índice.
       Se llama al inicio y cada vez que el usuario avanza.
       ──────────────────────────────────────────────────── */
    function renderExercise(index) {
      const ex     = exercises[index];               // Datos del ejercicio actual
      const isLast = index === exercises.length - 1; // ¿Es el último ejercicio?

      // Calculamos el porcentaje de progreso para la barra visual
      // (no contamos el ejercicio actual como completado hasta que se responda)
      const progress = (index / exercises.length) * 100;

      // Dividimos el texto del ejercicio en dos partes: lo que va antes y después del hueco "____"
      // Ejemplo: "Ihr ____ euch wieder" → ["Ihr ", " euch wieder"]
      const parts       = ex.text.split('____');
      const beforeBlank = parts[0] || ''; // Texto antes del hueco
      const afterBlank  = parts[1] || ''; // Texto después del hueco

      // Construimos el HTML completo del ejercicio y lo insertamos en el wrapper
      wrapper.innerHTML = `
        <div class="exercise-wrapper">

          <!-- Barra de progreso: muestra cuántos ejercicios quedan -->
          <div class="exercise-progress">
            <span class="progress-label">Progreso</span>
            <div class="progress-bar-track">
              <div class="progress-bar-fill" style="width:${progress}%"></div>
            </div>
            <span class="progress-count">${index + 1} / ${exercises.length}</span>
          </div>

          <!-- Verso original completo, sin el hueco, como referencia -->
          <div class="source-line-block">
            <div class="source-line-label">Verso original</div>
            <div class="source-line-text">${ex.source_line}</div>
          </div>

          <!-- Tarjeta principal del ejercicio -->
          <div class="exercise-card">
            <!-- El verso con el hueco: antes del hueco + input + después del hueco -->
            <div class="exercise-verse" id="verse-text">
              ${beforeBlank}<span class="blank-container"><input
                type="text"
                id="answer-input"
                class="answer-input"
                placeholder="…"
                autocomplete="off"
                autocorrect="off"
                spellcheck="false"
              /></span>${afterBlank}
            </div>

            <!-- Botones de acción: Verificar (siempre visible) y Siguiente (oculto hasta acertar) -->
            <div class="answer-actions">
              <button class="btn btn-primary" id="check-btn">Verificar</button>
              <button class="btn btn-secondary" id="next-btn" style="display:none">
                ${isLast ? 'Finalizar' : 'Siguiente →'}
              </button>
            </div>

            <!-- Área de retroalimentación: muestra si la respuesta fue correcta o no -->
            <div class="feedback-message" id="feedback"></div>
          </div>

          <!-- Sección de pistas: tres botones independientes que revelan paneles -->
          <div class="hints-section">
            <div class="hints-header">
              <span class="hints-title">Pistas disponibles</span>
            </div>
            <div class="hints-buttons">
              <button class="hint-btn" id="hint-context-btn">💬 Contexto</button>
              <button class="hint-btn" id="hint-linguistic-btn">📖 Gramática</button>
              <button class="hint-btn" id="hint-letter-btn">🔤 Primera letra</button>
            </div>
            <!-- Panel de pista contextual (oculto por defecto) -->
            <div class="hint-panel" id="hint-context-panel">
              <div class="hint-label">Contexto</div>
              <div class="hint-text">${ex.hint_context}</div>
            </div>
            <!-- Panel de pista gramatical (oculto por defecto) -->
            <div class="hint-panel" id="hint-linguistic-panel">
              <div class="hint-label">Pista gramatical</div>
              <div class="hint-text">${ex.hint_linguistic}</div>
            </div>
            <!-- Panel de primera letra (oculto por defecto) -->
            <div class="hint-panel" id="hint-letter-panel">
              <div class="hint-label">Primera letra</div>
              <div class="hint-letter-display">${ex.hint_letter.toUpperCase()}</div>
            </div>
          </div>

          <!-- Nota lingüística: oculta hasta que el usuario responda correctamente -->
          <div class="note-section" id="note-section">
            <div class="note-label">Nota lingüística</div>
            <div class="note-text">${ex.note}</div>
          </div>

        </div>
      `;

      // ── Referencias a los elementos del DOM recién creados ──
      const input       = document.getElementById('answer-input');
      const checkBtn    = document.getElementById('check-btn');
      const nextBtn     = document.getElementById('next-btn');
      const feedback    = document.getElementById('feedback');
      const noteSection = document.getElementById('note-section');

      // Ponemos el foco en el input para que el usuario pueda escribir inmediatamente
      input.focus();


      /* ── Evento: tecla Enter en el input ───────────────
         Permite al usuario verificar o avanzar sin usar el ratón.
         Si el botón "Verificar" está visible, lo activa.
         Si ya respondió y el botón "Siguiente" está visible, lo activa.
      ────────────────────────────────────────────────── */
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          if (checkBtn.style.display !== 'none') checkBtn.click();
          else if (nextBtn.style.display !== 'none') nextBtn.click();
        }
      });


      /* ── Evento: clic en "Verificar" ───────────────────
         Compara la respuesta del usuario con la respuesta correcta.
         Si es correcta: bloquea el input, muestra feedback positivo,
           revela la nota lingüística y muestra el botón "Siguiente".
         Si es incorrecta: muestra feedback negativo y permite reintentar.
      ────────────────────────────────────────────────── */
      checkBtn.addEventListener('click', () => {
        const userAnswer = input.value;

        // Validación: no permitimos verificar si el campo está vacío
        if (!userAnswer.trim()) {
          feedback.textContent = 'Escribe una respuesta antes de verificar.';
          feedback.className = 'feedback-message';
          input.focus();
          return;
        }

        if (answersMatch(userAnswer, ex.answer)) {
          // ── Respuesta CORRECTA ──────────────────────────
          input.classList.remove('incorrect');
          input.classList.add('correct');
          input.value = ex.answer; // Mostramos la ortografía correcta (con umlaut si corresponde)
          input.readOnly = true;   // Bloqueamos el input para que no se pueda editar

          feedback.textContent = '✓ Correcto. Sehr gut!';
          feedback.className = 'feedback-message correct';

          checkBtn.style.display = 'none'; // Ocultamos "Verificar"
          nextBtn.style.display  = '';     // Mostramos "Siguiente" o "Finalizar"

          noteSection.classList.add('visible'); // Revelamos la nota lingüística
          correctCount++; // Incrementamos el contador de aciertos

          // Actualizamos la barra de progreso para incluir este ejercicio como completado
          const pbar = document.querySelector('.progress-bar-fill');
          if (pbar) pbar.style.width = `${((index + 1) / exercises.length) * 100}%`;

        } else {
          // ── Respuesta INCORRECTA ────────────────────────
          input.classList.remove('correct');
          input.classList.add('incorrect');
          feedback.textContent = '✗ No es correcto. Inténtalo de nuevo o consulta una pista.';
          feedback.className = 'feedback-message incorrect';
          input.select(); // Seleccionamos el texto del input para facilitar reescribir
        }
      });


      /* ── Evento: clic en "Siguiente" o "Finalizar" ─────
         Si es el último ejercicio, llama a showCompletion() para mostrar
         la pantalla de resultados finales.
         Si no es el último, incrementa el índice y vuelve a renderizar.
      ────────────────────────────────────────────────── */
      nextBtn.addEventListener('click', () => {
        if (isLast) {
          // Mostramos la pantalla de finalización con las estadísticas
          showCompletion(exercises.length, correctCount);
        } else {
          // Avanzamos al siguiente ejercicio
          currentIndex++;
          renderExercise(currentIndex);
        }
      });


      /* ── Eventos: botones de pistas (toggle) ───────────
         Cada botón controla su propio panel.
         Un clic lo abre; otro clic lo cierra (comportamiento toggle).
         También cambia la apariencia del botón al estado "revealed".
         Usamos un array de pares [idBotón, idPanel] para no repetir código.
      ────────────────────────────────────────────────── */
      [
        ['hint-context-btn',    'hint-context-panel'],
        ['hint-linguistic-btn', 'hint-linguistic-panel'],
        ['hint-letter-btn',     'hint-letter-panel'],
      ].forEach(([btnId, panelId]) => {
        const btn   = document.getElementById(btnId);
        const panel = document.getElementById(panelId);

        btn.addEventListener('click', () => {
          // Leemos el estado actual del panel
          const isVisible = panel.classList.contains('visible');

          // Alternamos la visibilidad del panel y el estilo del botón
          panel.classList.toggle('visible', !isVisible);
          btn.classList.toggle('revealed', !isVisible);
        });
      });

    } // fin de renderExercise()


    /* ────────────────────────────────────────────────────
       showCompletion(total, correct)
       Muestra la pantalla de resultados al finalizar el nivel.
       Calcula y presenta: respuestas correctas, errores y precisión.
       Ofrece dos acciones: repetir el nivel o volver al menú de niveles.
       ──────────────────────────────────────────────────── */
    function showCompletion(total, correct) {
      const errors   = total - correct;
      const accuracy = Math.round((correct / total) * 100);

      wrapper.innerHTML = `
        <div class="completion-screen visible">
          <div class="completion-ornament">✦</div>
          <div class="completion-title">Nivel completado</div>
          <div class="completion-subtitle">${level ? level.title + ' · ' + level.subtitle : ''}</div>

          <!-- Estadísticas del nivel: correctas, errores y porcentaje de precisión -->
          <div class="completion-stats">
            <div class="stat-item">
              <span class="stat-number">${correct}</span>
              <span class="stat-label">Correctas</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">${errors}</span>
              <span class="stat-label">Errores</span>
            </div>
            <div class="stat-item">
              <span class="stat-number">${accuracy}%</span>
              <span class="stat-label">Precisión</span>
            </div>
          </div>

          <!-- Botones de navegación post-nivel -->
          <div style="display:flex; gap:1rem; justify-content:center; flex-wrap:wrap;">
            <!-- location.reload() recarga la página para reiniciar el nivel desde cero -->
            <button class="btn btn-primary" onclick="location.reload()">Repetir nivel</button>
            <!-- Navega de vuelta a la lista de niveles de la obra actual -->
            <button class="btn btn-secondary" onclick="window.location.href='levels.html?book=${book ? book.id : ''}'">Volver a niveles</button>
          </div>
        </div>
      `;
    }

    // ── Arranque: renderizamos el primer ejercicio (índice 0) ──
    renderExercise(0);

  } catch (err) {
    // Si hay cualquier error al cargar los datos, lo mostramos en pantalla
    wrapper.innerHTML = `<div class="error-message">Error al cargar ejercicios: ${err.message}</div>`;
  }
}


/* ══════════════════════════════════════════════════════════
   ROUTER — Inicialización según la página actual
   ──────────────────────────────────────────────────────────
   Cada archivo HTML tiene un atributo data-page en <body>
   que indica qué función de inicialización debe ejecutarse.
   Esperamos a que el DOM esté completamente cargado
   antes de llamar a cualquier función.
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Leemos el valor de data-page del <body> del HTML actual
  const page = document.body.dataset.page;

  // Llamamos a la función de inicialización correspondiente
  if (page === 'index')    initIndex();    // index.html    → lista de autores
  if (page === 'books')    initBooks();    // books.html    → obras de un autor
  if (page === 'levels')   initLevels();   // levels.html   → niveles de una obra
  if (page === 'exercise') initExercise(); // exercise.html → ejercicios de un nivel
});
