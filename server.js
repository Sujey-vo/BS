const express = require('express');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const session = require('express-session');
const PDFDocument = require('pdfkit');
const path = require('path'); // Agregado para manejar rutas de archivos

const app = express();
const port = 3000;

// Inicializar Firebase Admin
const serviceAccount = require('./bamba-studio-firebase-adminsdk.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bamba-studio-default-rtdb.firebaseio.com"
});

const db = admin.database();

// Configuración de Nodemailer
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'Citas.bamba@gmail.com',
    pass: 'jygilhbwhztmzjti'
  }
});

// Lista de usuarios con roles
const usuarios = {
  'admin@bamba.com': { password: 'password123', role: 'admin' },
  'user@bamba.com': { password: 'user456', role: 'user' }
};

// Configuración de Express
app.use(express.static('public'));
app.use(express.json());
app.use(session({
  secret: 'tu-secreto-super-seguro',
  resave: false,
  saveUninitialized: false,
  cookie: { secure: false }
}));

// Middleware para verificar autenticación
function requireAuth(req, res, next) {
  console.log('requireAuth:', req.session); // Depuración
  if (req.session.loggedIn && req.session.email) {
    next();
  } else {
    console.log('No autenticado, redirigiendo a login.html');
    res.redirect('/INDEX/INDEX/REGISTRO INCIAR SESION/login.html');
  }
}

// Middleware para verificar Generally (requireAdmin)
function requireAdmin(req, res, next) {
  console.log('requireAdmin:', req.session); // Depuración
  if (req.session.loggedIn && req.session.role === 'admin') {
    next();
  } else {
    console.log('No admin, redirigiendo a login.html');
    res.redirect('/INDEX/INDEX/REGISTRO INCIAR SESION/login.html');
  }
}

// Función para enviar notificación
async function enviarNotificacion(email, cita, accion) {
  const mensajes = {
    creada: `Tu cita ha sido registrada:\nFecha: ${cita.fecha}\nHora: ${cita.hora}\nEstado: ${cita.estado}`,
    editada: `Tu cita ha sido actualizada:\nFecha: ${cita.fecha}\nHora: ${cita.hora}\nEstado: ${cita.estado}`,
    completada: `Tu cita ha sido marcada como completada:\nFecha: ${cita.fecha}\nHora: ${cita.hora}`,
    cancelada: `Tu cita ha sido cancelada:\nFecha: ${cita.fecha}\nHora: ${cita.hora}`
  };
  const mailOptions = {
    from: 'Citas.bamba@gmail.com',
    to: email,
    subject: `Bamba Studio: Tu cita ha sido ${accion}`,
    text: `Hola ${cita.cliente_nombre},\n\n${mensajes[accion]}\n\nGracias por elegirnos,\nBamba Studio`
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email enviado a ${email} por ${accion}`);
  } catch (error) {
    console.error(`Error enviando email por ${accion}:`, error);
  }
}

// Validar fecha no pasada
function esFechaValida(fecha) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechaSeleccionada = new Date(fecha);
  return fechaSeleccionada >= hoy;
}

// Validar horario (10:00 AM - 8:00 PM)
function esHoraValida(hora) {
  const [horas, minutos] = hora.split(':').map(Number);
  const horaEnMinutos = horas * 60 + minutos;
  const inicio = 10 * 60;
  const fin = 20 * 60;
  return horaEnMinutos >= inicio && horaEnMinutos <= fin;
}

// Convertir hora a minutos desde medianoche
function horaAMinutos(hora) {
  const [horas, minutos] = hora.split(':').map(Number);
  return horas * 60 + minutos;
}

// Verificar diferencia mínima de 2.5 horas entre citas
async function tieneDiferenciaMinima(fecha, hora, excludeId = null) {
  const MIN_DIFERENCIA_MINUTOS = 150;
  const horaEnMinutos = horaAMinutos(hora);
  const citasRef = db.ref('citas');
  const snapshot = await citasRef.once('value');
  if (snapshot.exists()) {
    const citas = snapshot.val();
    for (const id in citas) {
      if (id !== excludeId && citas[id].fecha === fecha) {
        const citaExistenteMinutos = horaAMinutos(citas[id].hora);
        const diferencia = Math.abs(horaEnMinutos - citaExistenteMinutos);
        if (diferencia < MIN_DIFERENCIA_MINUTOS) {
          return false;
        }
      }
    }
  }
  return true;
}

// Verificar si ya existe una cita en la misma fecha y hora
async function existeCitaDuplicada(fecha, hora, excludeId = null) {
  const citasRef = db.ref('citas');
  const snapshot = await citasRef.once('value');
  if (snapshot.exists()) {
    const citas = snapshot.val();
    for (const id in citas) {
      if (id !== excludeId && citas[id].fecha === fecha && citas[id].hora === hora) {
        return true;
      }
    }
  }
  return false;
}

// Ruta de login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Intento de login:', email); // Depuración
  if (usuarios[email] && usuarios[email].password === password) {
    req.session.loggedIn = true;
    req.session.email = email;
    req.session.role = usuarios[email].role;
    console.log('Login exitoso, sesión:', req.session); // Depuración
    const redirectUrl = usuarios[email].role === 'admin' 
      ? '/INDEX/INDEX/index_page.html' 
      : '/INDEX/INDEX/user_page.html';
    res.status(200).json({ message: 'Inicio de sesión exitoso', redirectUrl });
  } else {
    console.log('Credenciales inválidas para:', email);
    res.status(401).json({ message: 'Credenciales inválidas' });
  }
});

// Ruta de logout
app.post('/api/logout', (req, res) => {
  console.log('Cerrando sesión'); // Depuración
  req.session.destroy(() => {
    res.status(200).json({ message: 'Sesión cerrada' });
  });
});

// Ruta raíz: Servir index_page.html con autenticación de admin
app.get('/', requireAdmin, (req, res) => {
  console.log('Accediendo a ruta raíz, sirviendo index_page.html'); // Depuración
  res.sendFile(path.join(__dirname, 'public', 'INDEX', 'INDEX', 'index_page.html'));
});

// Proteger la página de citas (acceso completo solo para admin)
app.get('/INDEX/INDEX/index_page.html', requireAdmin, (req, res) => {
  console.log('Accediendo a /INDEX/INDEX/index_page.html'); // Depuración
  res.sendFile(path.join(__dirname, 'public', 'INDEX', 'INDEX', 'index_page.html'));
});

// Proteger la página de login
app.get('/INDEX/INDEX/REGISTRO INCIAR SESION/login.html', (req, res) => {
  console.log('Accediendo a login.html'); // Depuración
  res.sendFile(path.join(__dirname, 'public', 'INDEX', 'INDEX', 'REGISTRO INCIAR SESION', 'login.html'));
});

// Proteger la página de citas para usuarios (solo registro)
app.get('/INDEX/INDEX/user_page.html', requireAuth, (req, res) => {
  console.log('Accediendo a user_page.html, rol:', req.session.role); // Depuración
  if (req.session.role === 'user') {
    res.sendFile(path.join(__dirname, 'public', 'INDEX', 'INDEX', 'user_page.html'));
  } else {
    res.redirect('/INDEX/INDEX/index_page.html');
  }
});

// Ruta de prueba
app.get('/api/test', (req, res) => {
  res.send('¡El servidor funciona!');
});

// Obtener todas las citas (solo admin)
app.get('/api/citas', requireAdmin, async (req, res) => {
  try {
    const citasRef = db.ref('citas');
    const snapshot = await citasRef.once('value');
    if (snapshot.exists()) {
      res.status(200).json(snapshot.val());
    } else {
      res.status(200).json({});
    }
  } catch (error) {
    console.error('Error al obtener citas:', error);
    res.status(500).send('Error al obtener citas: ' + error.message);
  }
});

// Guardar una cita (permitido para admin y user)
app.post('/api/citas', requireAuth, async (req, res) => {
  const { cliente_nombre, email, fecha, hora } = req.body;
  const citaId = Date.now();

  if (!cliente_nombre || typeof cliente_nombre !== 'string' || cliente_nombre.trim() === '') {
    return res.status(400).send('El nombre del cliente es obligatorio.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).send('Ingresa un email válido.');
  }
  if (!fecha || !esFechaValida(fecha)) {
    return res.status(400).send('La fecha no puede ser anterior a hoy.');
  }
  if (!hora || !/^\d{2}:\d{2}$/.test(hora) || !esHoraValida(hora)) {
    return res.status(400).send('La hora debe estar entre 10:00 AM y 8:00 PM.');
  }
  if (await existeCitaDuplicada(fecha, hora)) {
    return res.status(400).send('Ya existe una cita en esa fecha y hora.');
  }
  if (!(await tieneDiferenciaMinima(fecha, hora))) {
    return res.status(400).send('Las citas deben tener al menos 2.5 horas de diferencia.');
  }

  const nuevaCita = {
    cliente_nombre: cliente_nombre.trim(),
    email: email.trim(),
    fecha,
    hora,
    estado: 'pendiente'
  };

  try {
    await db.ref('citas/' + citaId).set(nuevaCita);
    await enviarNotificacion(email, nuevaCita, 'creada');
    res.status(200).send('Cita guardada con éxito');
  } catch (error) {
    console.error('Error al guardar cita:', error);
    res.status(500).send('Error al guardar la cita: ' + error.message);
  }
});

// Actualizar una cita (solo admin)
app.put('/api/citas/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const { cliente_nombre, email, fecha, hora, estado } = req.body;

  if (!cliente_nombre || typeof cliente_nombre !== 'string' || cliente_nombre.trim() === '') {
    return res.status(400).send('El nombre del cliente es obligatorio.');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).send('Ingresa un email válido.');
  }
  if (!fecha || !esFechaValida(fecha)) {
    return res.status(400).send('La fecha no puede ser anterior a hoy.');
  }
  if (!hora || !/^\d{2}:\d{2}$/.test(hora) || !esHoraValida(hora)) {
    return res.status(400).send('La hora debe estar entre 10:00 AM y 8:00 PM.');
  }
  if (await existeCitaDuplicada(fecha, hora, id)) {
    return res.status(400).send('Ya existe otra cita en esa fecha y hora.');
  }
  if (!(await tieneDiferenciaMinima(fecha, hora, id))) {
    return res.status(400).send('Las citas deben tener al menos 2.5 horas de diferencia.');
  }
  if (!['pendiente', 'completada', 'cancelada'].includes(estado)) {
    return res.status(400).send('Estado inválido.');
  }

  const updatedCita = { 
    cliente_nombre: cliente_nombre.trim(), 
    email: email.trim(), 
    fecha, 
    hora, 
    estado 
  };
  try {
    await db.ref('citas/' + id).update(updatedCita);
    await enviarNotificacion(email, updatedCita, 'editada');
    res.status(200).send('Cita actualizada con éxito');
  } catch (error) {
    console.error('Error al actualizar cita:', error);
    res.status(500).send('Error al actualizar la cita: ' + error.message);
  }
});

// Marcar como completada (solo admin)
app.put('/api/citas/:id/completar', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const citaRef = db.ref('citas/' + id);
    const snapshot = await citaRef.once('value');
    if (!snapshot.exists()) {
      return res.status(404).send('Cita no encontrada');
    }
    const cita = snapshot.val();
    const updatedCita = {
      cliente_nombre: cita.cliente_nombre,
      email: cita.email,
      fecha: cita.fecha,
      hora: cita.hora,
      estado: 'completada'
    };
    await citaRef.update(updatedCita);
    await enviarNotificacion(cita.email, updatedCita, 'completada');
    res.status(200).send('Cita marcada como completada');
  } catch (error) {
    console.error('Error al marcar como completada:', error);
    res.status(500).send('Error al marcar como completada: ' + error.message);
  }
});

// Cancelar una cita (solo admin)
app.delete('/api/citas/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    const citaRef = db.ref('citas/' + id);
    const snapshot = await citaRef.once('value');
    if (!snapshot.exists()) {
      return res.status(404).send('Cita no encontrada');
    }
    const cita = snapshot.val();
    await citaRef.remove();
    await enviarNotificacion(cita.email, cita, 'cancelada');
    res.status(200).send('Cita eliminada con éxito');
  } catch (error) {
    console.error('Error al eliminar cita:', error);
    res.status(500).send('Error al eliminar la cita: ' + error.message);
  }
});

// Generar reporte (JSON para tabla, PDF o CSV)
app.get('/api/reporte', requireAdmin, async (req, res) => {
  const { fechaInicio, fechaFin, formato } = req.query;
  const hoy = new Date().toISOString().split('T')[0];
  const inicio = fechaInicio || hoy;
  const fin = fechaFin || hoy;

  try {
    const citasRef = db.ref('citas');
    const snapshot = await citasRef.once('value');
    let citas = snapshot.exists() ? snapshot.val() : {};

    // Filtrar citas por rango de fechas
    citas = Object.entries(citas)
      .filter(([_, cita]) => cita.fecha >= inicio && cita.fecha <= fin)
      .reduce((acc, [id, cita]) => ({ ...acc, [id]: cita }), {});

    if (Object.keys(citas).length === 0) {
      return res.status(404).send('No hay citas en el rango seleccionado.');
    }

    if (formato === 'csv') {
      const csv = [
        'ID,Cliente,Email,Fecha,Hora,Estado',
        ...Object.entries(citas).map(([id, cita]) => 
          `${id},${cita.cliente_nombre},${cita.email},${cita.fecha},${cita.hora},${cita.estado}`
        )
      ].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_citas_${inicio}_a_${fin}.csv`);
      res.send(csv);
    } else if (formato === 'pdf') {
      const doc = new PDFDocument();
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=reporte_citas_${inicio}_a_${fin}.pdf`);
      doc.pipe(res);

      doc.fontSize(20).text('Reporte de Citas - Bamba Studio', { align: 'center' });
      doc.moveDown();
      doc.fontSize(14).text(`Rango: ${inicio} a ${fin}`, { align: 'center' });
      doc.moveDown();

      const tableTop = 150;
      const rowHeight = 20;
      let y = tableTop;

      doc.fontSize(10).text('ID', 50, y).text('Cliente', 100, y).text('Email', 200, y).text('Fecha', 300, y).text('Hora', 400, y).text('Estado', 450, y);
      y += rowHeight;
      doc.moveTo(50, y - 5).lineTo(550, y - 5).stroke();

      for (const [id, cita] of Object.entries(citas)) {
        doc.text(id, 50, y).text(cita.cliente_nombre, 100, y).text(cita.email, 200, y).text(cita.fecha, 300, y).text(cita.hora, 400, y).text(cita.estado, 450, y);
        y += rowHeight;
      }
      doc.end();
    } else {
      res.status(200).json(citas);
    }
  } catch (error) {
    console.error('Error al generar reporte:', error);
    res.status(500).send('Error al generar el reporte: ' + error.message);
  }
});

app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});