const { leerArchivoJSON } = require('./archivos.js');
const path = require('node:path');
const express = require('express');
const PORT = 3000;
const expressLayouts = require('express-ejs-layouts');
const morgan = require("morgan");

const rutaDatos = path.join(__dirname, '..', 'datos', 'reservas.json');

let numeroDeSolicitud = 0;
function identificarSolicitud(req, res, next) {
    numeroDeSolicitud += 1;
    res.locals.solicitudId = `BIB-${String(numeroDeSolicitud).padStart(4, "0")}`;
    console.log(`[${res.locals.solicitudId}] ${req.method} ${req.originalUrl}`);
    next();
}
function medirDuracion(req, res, next) {
    const inicio = process.hrtime.bigint();
    res.on("finish", () => {
        const fin = process.hrtime.bigint();
        const milisegundos = Number(fin - inicio) / 1_000_000;
        console.log(
            `[${res.locals.solicitudId}] ${req.method} ${req.originalUrl} ` +
            `${res.statusCode} ${milisegundos.toFixed(2)} ms`,
        );
    });
    next();
}

function prepararAreaReservas(req, res, next) {
    res.locals.seccion = "Reservas de Salas para estudiar";
    console.log("seccion:", res.locals.seccion);
    next();
}
function validarReserva(req, res, next) {
    const salasPermitidas = ["Sala Norte", "Sala Sur", "Sala Multimedia"];
    const sala = String(req.body.sala ?? "").trim();
    const estudiante = String(req.body.estudiante ?? "").trim();
    const email = String(req.body.email ?? "").trim();
    const fecha = String(req.body.fecha ?? "").trim();
    const turno = String(req.body.turno ?? "").trim();
    const personas = Number(req.body.personas);
    if (!sala || !estudiante || !email || !fecha || !turno || !Number.isFinite(personas) || personas <= 0 || personas > 6) {
        return res.status(400).render("reservas/nueva", {
            titulo: "Agregar Nueva Reserva",
            error: "Completá todos los campos con valores válidos.",
            valores: req.body,
        });
    }
    if (!salasPermitidas.includes(sala)) {
        return res.status(400).render("reservas/nueva", {
            titulo: "Agregar Nueva Reserva",
            error: "La sala seleccionada no es válida.",
            valores: req.body,
        });
    }
    req.reservaValidada = { sala, estudiante, email, fecha, turno, personas };
    next();
}

async function main() {
    try {
        const reservas = await leerArchivoJSON(rutaDatos);
        const app = express();
        function crearReserva(req, res) {
            const ultimoId = reservas.reduce(
                (mayorId, reserva) => Math.max(mayorId, reserva.id),
                0,
            );
            reservas.push({ id: ultimoId + 1, ...req.reservaValidada });
            res.redirect("/reservas");
        }

        app.set("view engine", "ejs");
        app.set("views", path.join(__dirname, "..", "views"));
        app.use(expressLayouts);
        app.set("layout", "layouts/main");
        app.use(morgan("dev"));

        app.use(identificarSolicitud);
        app.use(medirDuracion);

        app.use(express.static(path.join(__dirname, "..", "public")));
        app.use(express.urlencoded({ extended: false }));

        app.get("/", (req, res) => {
            res.render("inicio", { titulo: "Página de Inicio" });
        });

        app.get("/api/reservas", (req, res) => {
            res.json(reservas);
        });

        app.get("/estado", (req, res) => {
            res.status(200).json({
                servicio: "activo",
                reservas: reservas.length,
                solicitudId: res.locals.solicitudId,
            });
        });

        const reservasRouter = express.Router();
        reservasRouter.use(prepararAreaReservas);
        app.use("/reservas", reservasRouter);
        
        reservasRouter.get("/", (req, res) => {
            res.render("reservas/lista", {
                titulo: "Reservas",
                reservas,
            });
        });

        reservasRouter.get("/nueva", (req, res) => {
            res.render("reservas/nueva", {
                salasPermitidas: ["Sala Norte", "Sala Sur", "Sala Multimedia"],
                titulo: "Nueva Reserva",
                error: null,
                valores: {},
            });
        });

        reservasRouter.get("/:id", (req, res) => {
            const id = Number(req.params.id);
            const reserva = reservas.find((elemento) => elemento.id === id);
            if (!reserva) {
                return res.status(404).render("reservas/no-encontrado", {
                    titulo: "Reserva no encontrada",
                    mensaje: "No existe una reserva con ese identificador.",
                });
            }
            res.render("reservas/detalle", {
                titulo: reserva.sala,
                reserva,
            });
        });

        reservasRouter.post("/", validarReserva, crearReserva);

        app.use((req, res) => {
            res.status(404).render("no-encontrado", {
                titulo: "Página no encontrada",
                mensaje: "La dirección solicitada no existe.",
            });
        });

        app.listen(PORT, () => {
            console.log(`Servidor escuchando en http://localhost:${PORT}`);
        });

    } catch (error) {
        console.error('Error al leer el archivo JSON:', error);
    }
}

main();