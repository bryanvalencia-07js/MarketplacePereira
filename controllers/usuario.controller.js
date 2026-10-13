//Importamos los usuarios temporales
let usuarios = require("../data/usuarios")

//GET - listar todos los usuarios
const listarUsuarios = (req, res) => {
	res.json({
		total: usuarios.length,
		usuarios: usuarios
	});
};

//GET - Buscar usuario por ID
const buscarUsuario = (req, res) => {

	const id = Number(req.params.id);
	
	const usuario = usuarios.find(
		usuario => usuario.id === id
);

	if (!usuario) {

		return res.status(404).json({ 
			mensaje: "Usuario no encontrado"
		});

	}

	res.json(usuario);
	};

//POST - Registrar un nuevo usuario
const crearUsuario = (req, res) => {
	
	const {
		nombre,
		apellido,
		correo,
		telefono,
		rol
	} = req.body;

	//Validamos campos obligatorios
	if (!nombre || !apellido || !correo) {
		return res.status(400).json({
			mensaje: "Nombre, apellido y correo son obligatorios"
		});
	}

	//Revisamos si el correo ya existe
	const correoExiste = usuarios.some( usuario => usuario.correo === correo );

	if (correoExiste) {
		return res.status(400).json({
			mensaje: "El correo ya está registrado"
		});
	}

	//Creamos el nuevo usuario
	const nuevoUsuario = {
		id: usuarios.length > 0 ?
			Math.max(...usuarios.map(usuario => usuario.id)) + 1 : 1,
		nombre,
		apellido,
		correo,
		telefono,
		rol
	};

	//Agregamos el usuario al arreglo
	usuarios.push(nuevoUsuario);

	//Respondemos con código 201
	res.status(201).json({
		mensaje: "Usuario registrado correctamente",
		usuario: nuevoUsuario
	});
};

//PUT - Actualizar usuario
const actualizarUsuario = (req, res) => {

	const id = Number(req.params.id);

	const usuario = usuarios.find(usuario => usuario.id === id);

	//Si el usuario no existe
	if (!usuario) {
		return res.status(404).json({
			mensaje: "Usuario no encontrado"
		});
	}

	//Datos enviados en el body
	const {
                nombre,
                apellido,
                correo,
                telefono,
                rol
	} = req.body

	//Actualizamos solo los datos enviados
	usuario.nombre = nombre || usuario.nombre;
        usuario.apellido = apellido || usuario.apellido;
        usuario.correo = correo || usuario.correo;
        usuario.telefono = telefono || usuario.telefono;
        usuario.rol = rol || usuario.rol;

	res.json({
		mensaje: "Usuario actualizado correctamente",
		usuario: usuario
	});
};

//DELETE - Eliminar Usuario
const eliminarUsuario = (req, res) => {
	const id = Number(req.params.id);

	//Buscamos la posición del usuario
	const indice =
	usuarios.findIndex(
		usuario => usuario.id === id
	);

	//Si findIndex devuelve -1,
	//significa que el usuario no existe
	if (indice === -1) {
		return res.status(404).json({
			mensaje: "Usuario no encontrado"
		});
	}

	//Eliminamos el usuario del arreglo
	const usuarioEliminado = usuarios.splice(indice, 1);

	//Respondemos al cliente
	res.json({
		mensaje: "Usuario eliminado correctamente",
		usuario: usuarioEliminado[0]
	});
};

//Exportamos la función para poder usarla desde routes

module.exports = {
	listarUsuarios,
	buscarUsuario,
	crearUsuario,
	actualizarUsuario,
	eliminarUsuario
};