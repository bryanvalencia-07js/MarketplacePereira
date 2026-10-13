const express = require("express");

const router = express.Router();

const {
	listarUsuarios,
	buscarUsuario,
	crearUsuario,
	actualizarUsuario,
	eliminarUsuario
} = require ("../controllers/usuario.controller");


//GET - listar todos los usuarios
router.get("/", listarUsuarios);
router.get("/:id", buscarUsuario);
router.post("/", crearUsuario);
router.put("/:id", actualizarUsuario);
router.delete("/:id", eliminarUsuario);
module.exports = router;
