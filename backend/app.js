const express = require("express");
const cors = require("cors");

const usuarioRoutes = require("./routes/usuario.routes");

const app = express();

const PORT = 3000;


app.use(express.json());



app.use(cors());
app.use(express.static("public"));


// Ruta de prueba
app.get("/", (req, res) => {

    res.json({
        mensaje: "API Reactiva Pereira - servidor actualizado"
    });

});



app.use("/api/usuarios", usuarioRoutes);


app.listen(PORT, () => {

    console.log(
        `Servidor ejecutándose en http://localhost:${PORT}`
    );

});
