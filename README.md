# Trabajo práctico 05

## Descripción

Aplicación web desarrollada con Node.js y Express para consultar y gestionar reservas de salas de estudio. Permite visualizar las reservas existentes, consultar sus detalles y registrar nuevas reservas mediante un formulario.

El proyecto utiliza Express para gestionar las solicitudes HTTP, EJS para generar las vistas HTML dinámicas, `express-ejs-layouts` para compartir una estructura común entre las páginas y Morgan para registrar información de las solicitudes en la consola.

Además, incorpora middleware personalizados para identificar cada solicitud, medir el tiempo de respuesta, preparar la sección de reservas y validar los datos enviados desde el formulario.

Las reservas iniciales se leen desde el archivo JSON ubicado en `datos/reservas.json`. Las nuevas reservas se agregan a un arreglo en memoria durante la ejecución del servidor.

## Instalación

1. Clonar o descargar el repositorio del proyecto.
2. Abrir una terminal en la carpeta raíz.
3. Instalar las dependencias:

   ```bash
   npm install
   ```

Verificar que el archivo `package.json` incluya las dependencias necesarias: `express`, `ejs`, `express-ejs-layouts` y `morgan`.

## Ejecución

Iniciar el servidor con:

```bash
npm start
```

La aplicación estará disponible en:

http://localhost:3000

Para detener el servidor, presionar `Ctrl + C` en la terminal.

## Rutas

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/` | Muestra la página de inicio. |
| GET | `/estado` | Devuelve un JSON con el estado del servicio, la cantidad de reservas y el identificador de la solicitud. |
| GET | `/api/reservas` | Devuelve todas las reservas en formato JSON. |
| GET | `/reservas` | Muestra el listado de reservas. |
| GET | `/reservas/nueva` | Muestra el formulario para registrar una reserva. |
| GET | `/reservas/:id` | Muestra el detalle de una reserva según su identificador. |
| POST | `/reservas` | Valida y registra una nueva reserva en memoria. |
| — | Cualquier ruta inexistente | Muestra una página de error 404. |

Las rutas `/reservas`, `/reservas/nueva` y `/reservas/:id` se definen dentro de un router de Express montado en el prefijo `/reservas`.

Si se solicita una reserva que no existe, se devuelve una página de error con estado HTTP 404.

## Pipeline de middleware

Express procesa las solicitudes mediante una secuencia de middleware. Cada función puede ejecutar una tarea y llamar a `next()` para continuar con el siguiente paso, o finalizar la respuesta cuando corresponde.

En esta implementación, el orden de registro de los middleware globales es el siguiente:

1. `expressLayouts`: se registra mediante `app.use(expressLayouts)` para integrar los layouts de EJS.
2. `morgan("dev")`: registra información técnica de las solicitudes HTTP.
3. `identificarSolicitud`: asigna un identificador único a cada solicitud.
4. `medirDuracion`: mide el tiempo que tarda en completarse la respuesta.
5. `express.static`: permite servir archivos estáticos desde la carpeta `public`.
6. `express.urlencoded({ extended: false })`: procesa los datos enviados mediante formularios HTML.

Luego se registran las rutas generales, el router de reservas y, finalmente, el middleware que responde a las rutas inexistentes.

### Diagrama del pipeline para una reserva válida

```text
POST /reservas
       |
       v
expressLayouts
       |
       v
morgan("dev")
       |
       v
identificarSolicitud
       |
       v
medirDuracion
       |
       v
express.static
       |
       v
express.urlencoded
       |
       v
reservasRouter
       |
       v
prepararAreaReservas
       |
       v
validarReserva
       |
       v
crearReserva
       |
       v
302 Redirect: /reservas
       |
       v
GET /reservas
       |
       v
Respuesta con el listado actualizado
       |
       v
finish: registro de estado y duración
```

### Diagrama del pipeline para una reserva inválida

```text
POST /reservas
       |
       v
Middleware globales
       |
       v
reservasRouter
       |
       v
prepararAreaReservas
       |
       v
validarReserva
       |
       v
Datos inválidos
       |
       v
400 Bad Request
       |
       v
Render de reservas/nueva
con mensaje de error
       |
       v
Fin de la solicitud
```

Cuando la validación falla, no se ejecuta `crearReserva`, por lo que la reserva no se agrega al arreglo.

## Alcance de cada función

### Morgan

Se incorpora mediante `morgan("dev")`, un middleware de terceros que registra información técnica de las solicitudes, como el método HTTP, la ruta solicitada, el código de estado y el tiempo de respuesta.

Estos registros permiten observar el funcionamiento del servidor y detectar respuestas exitosas, redirecciones y errores.

### `identificarSolicitud`

Es un middleware personalizado que incrementa un contador y genera un identificador para cada solicitud, con el prefijo `BIB-` y cuatro dígitos.

Por ejemplo:

```text
BIB-0001
BIB-0002
BIB-0003
```

El identificador se guarda en `res.locals.solicitudId`, lo que permite utilizarlo en las vistas y en la ruta `/estado`. También se imprime en la consola junto con el método HTTP y la URL solicitada.

### `medirDuracion`

Registra el instante inicial mediante `process.hrtime.bigint()` y agrega un listener al evento `finish` de la respuesta.

Cuando la respuesta termina, calcula el tiempo transcurrido en milisegundos e imprime el identificador, el método, la URL, el código de estado y la duración.

Se utiliza `finish` porque permite obtener el estado final de la respuesta y medir el tiempo hasta que esta se completa, en lugar de calcularlo inmediatamente después de llamar a `next()`.

### `prepararAreaReservas`

Es un middleware asociado al router de reservas. Asigna el texto `"Reservas de Salas para estudiar"` a `res.locals.seccion` y lo registra en la consola.

Al utilizar `reservasRouter.use(prepararAreaReservas)`, la función se ejecuta en las solicitudes que ingresan a las rutas gestionadas por ese router.

### `validarReserva`

Es un middleware específico de la ruta `POST /reservas`. Obtiene los datos de `req.body`, elimina espacios al principio y al final de los campos de texto y convierte la cantidad de personas a un valor numérico.

Comprueba que los campos obligatorios estén completos, que la cantidad de personas sea mayor que cero y no supere seis, y que la sala seleccionada pertenezca a las opciones permitidas.

Si los datos no son válidos, responde con estado HTTP 400 y vuelve a mostrar el formulario con un mensaje de error y los valores enviados.

Si los datos superan las comprobaciones implementadas, prepara el objeto `req.reservaValidada` y ejecuta `next()` para continuar con el registro de la reserva.

### `crearReserva`

Es el manejador final de la solicitud POST. Busca el mayor identificador existente, genera el siguiente número, agrega la reserva validada al arreglo `reservas` y redirige al usuario a `/reservas`.

Esta función no llama a `next()` porque ya finaliza el flujo mediante una redirección.

### Router de reservas

Se crea con `express.Router()` y se monta en la aplicación mediante:

```js
app.use("/reservas", reservasRouter);
```

El router organiza las rutas relacionadas con las reservas y permite aplicarles middleware específicos sin afectar directamente a las rutas generales, como `/` y `/estado`.

Por ejemplo, la ruta interna `reservasRouter.get("/")` corresponde a `GET /reservas`, mientras que `reservasRouter.get("/nueva")` corresponde a `GET /reservas/nueva`.

### Middleware de error 404

Se registra después de las rutas de la aplicación. Si ninguna ruta anterior responde a la solicitud, devuelve una página HTML con estado HTTP 404 y un mensaje que indica que la dirección solicitada no existe.

## Validación

La validación se realiza en el servidor mediante el middleware `validarReserva`, por lo que no depende exclusivamente de las restricciones que puedan configurarse en el formulario HTML.

Actualmente, la función comprueba:

- Que sala, estudiante, email, fecha y turno no estén vacíos.
- Que la cantidad de personas sea numérica, mayor que cero y no superior a seis.
- Que la sala pertenezca a la lista de opciones permitidas: `Sala Norte`, `Sala Sur` o `Sala Multimedia`.

Cuando se detecta un error, se responde con HTTP 400 y se vuelve a renderizar el formulario.


## Pruebas manuales

Se pueden realizar las siguientes pruebas desde el navegador y mediante el formulario:

| Prueba | Resultado esperado |
|---|---|
| Acceder a `/` | Página de inicio con estado 200. |
| Acceder a `/estado` | JSON con el servicio activo, la cantidad de reservas y el identificador de solicitud. |
| Acceder a `/api/reservas` | Respuesta JSON con las reservas. |
| Acceder a `/reservas` | Listado de reservas con estado 200. |
| Acceder a `/reservas/nueva` | Formulario de nueva reserva con estado 200. |
| Consultar una reserva existente | Página de detalle con estado 200. |
| Consultar un identificador inexistente | Página de error 404. |
| Enviar el formulario vacío | Respuesta 400 y mensaje de error. |
| Seleccionar una sala no permitida | Respuesta 400 y mensaje de error. |
| Enviar una reserva válida | Redirección 302 a `/reservas` y posterior visualización del listado actualizado. |
| Acceder a una ruta inexistente | Página de error 404. |


## Persistencia temporal

Las reservas iniciales se cargan desde `datos/reservas.json` mediante la función `leerArchivoJSON`. Durante la ejecución, las nuevas reservas se incorporan al arreglo `reservas`, que se mantiene en memoria.

La función `crearReserva` no escribe los nuevos registros en el archivo JSON. Por eso, las reservas agregadas mediante el formulario se pierden al detener o reiniciar el servidor y se vuelve a cargar el conjunto de datos inicial.

Este comportamiento permite trabajar con datos temporales sin incorporar una base de datos ni implementar escritura de archivos.