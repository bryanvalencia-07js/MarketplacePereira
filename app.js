const express = require("express");
const cors = require("cors");

const usuarioRoutes = require("./routes/usuario.routes");

const app = express();

const PORT = 3000;


// Middleware para recibir datos JSON
app.use(express.json());


// Middleware para permitir peticiones desde otros orígenes
app.use(cors());


// Ruta de prueba
app.get("/", (req, res) => {

    res.json({
        mensaje: "API Reactiva Pereira - servidor actualizado"
    });

});

//Rutas del modulo usuarios

app.use("/api/usuarios", usuarioRoutes);

// Iniciar servidor
app.listen(PORT, () => {

    console.log(
        `Servidor ejecutándose en http://localhost:${PORT}`
    );

});
