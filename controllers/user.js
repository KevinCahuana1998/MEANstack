var validator = require('validator');
var User = require('../models/user');
var bcrypt = require('bcrypt');
var jwt = require('../services/jwt');
var fs = require('fs');
var path = require('path');

var controller = {
    probando: function(req, res) {
        return res.status(200).send({
            message: "Metodo probando"
        });
    },

    testeando: function(req, res) {
        return res.status(200).send({
            message: "Metodo testeando"
        });
    },

    save: function(req, res) {
        //recoger los parametros de la peticion
        var params = req.body;
        //Validar los datos
        try {
            validate_name = !validator.isEmpty(params.name);
            validate_surname = !validator.isEmpty(params.surname);
            validate_enail = !validator.isEmpty(params.email) && validator.isEmail(params.email);
            validate_password = !validator.isEmpty(params.password);
        } catch (err) {
            return res.status(400).send({
                message: "Faltan datos"
            });
        }

        if (validate_enail && validate_name && validate_password && validate_surname) {
            //Crear objeto de usuario
            var user = new User();
            //Asignar valores al usuario
            user.name = params.name;
            user.surname = params.surname;
            user.email = params.email.toLowerCase();
            user.image = null;
            user.role = 'ROLE_USER';

            //Comprobar si el usuario existe
            User.findOne({ email: user.email }, (error, userEncontrado) => {
                if (error) {
                    return res.status(200).send({
                        message: "Error al comprobar usuario"
                    });
                }
                //Si no existe cifrar la contrase;a
                if (!userEncontrado) {
                    bcrypt.hash(params.password, 10, (error, hash) => {

                        user.password = hash;

                        //guardar usuario
                        user.save((error, guardado) => {
                            if (error) {
                                return res.status(200).send({
                                    message: "Error al guardar usuario"
                                });
                            }

                            if (!guardado) {
                                return res.status(200).send({
                                    message: "El usuario no se ha guardado"
                                });
                            }
                            //Devolver respuesta
                            return res.status(200).send({
                                message: "Usuario guardado correctamente",
                                user: guardado
                            });

                        }); //close save

                    }); //close bcrypt

                } else {
                    return res.status(200).send({
                        message: "Usuario ya registrado"
                    });
                }
            });

        } else {
            return res.status(200).send({
                message: "Datos invalidos"
            });
        }
    },

    login: function(req, res) {
        //Recoger los parametros de la peticion
        params = req.body;
        //Validar los datos
        try {
            validate_enail = !validator.isEmpty(params.email) && validator.isEmail(params.email);
            validate_password = !validator.isEmpty(params.password);
        } catch (err) {
            return res.status(400).send({
                message: "Faltan datos"
            });
        }

        if (validate_password && validate_enail) {
            //Buscar usuarios que coincidan con el email que nos llega
            User.findOne({ email: params.email.toLowerCase() }, (error, userEncontrado) => {
                //Si lo encuentra
                //Comprobar la contrase;a( coincidencia email y password)
                if (error) {
                    return res.status(500).send({
                        message: "Error al encontrar usuario"
                    });
                }

                if (!userEncontrado) {
                    return res.status(404).send({
                        message: "Correo no registrado"
                    });
                } else {
                    //Comprobar conse;a enviada con la que esta en Mongo
                    bcrypt.compare(params.password, userEncontrado.password, (error, ToF) => {
                        if (ToF) {
                            //Generar token
                            if (params.getToken) {
                                return res.status(200).send({
                                    token: jwt.createToken(userEncontrado)
                                });
                            } else {
                                //Antes de eviar los datos del usuario, eliminamos su password (no de la BD)
                                userEncontrado.password = undefined;
                                //enviar datos del usuario(userEncontrado)
                                return res.status(200).send({
                                    message: "Logueado correctamente",
                                    userEncontrado
                                });

                            }

                        } else {
                            return res.status(400).send({
                                message: "Constrase;a incorrecta"
                            });
                        }
                    });
                }


            });
        }
    },

    update: function(req, res) {
        // 0. Crear un middleware para verificar el jwt token, ponerselo a la ruta

        //Recoger los datos a actualizar
        var params = req.body;

        //Validar datos
        try {
            var validate_name = !validator.isEmpty(params.name);
            var validate_surname = !validator.isEmpty(params.surname);
            var validate_enail = !validator.isEmpty(params.email) && validator.isEmail(params.email);

        } catch (err) {
            return res.status(400).send({
                message: "Faltan datos"
            });
        }


        //Eliminar datos innecesarios
        delete params.password;

        //Comprobar si el email es unico
        if (req.user.email != params.email) {
            User.findOne({ email: params.email.toLowerCase() }, (error, user) => {

                if (error) {
                    return res.status(500).send({
                        message: "Error al comprobar duplicidad del correo"
                    });
                }

                if (user && user.email == params.email) {
                    return res.status(400).send({
                        message: 'Correo ya existente, no puede modificarse'
                    });
                }

                return res.status(400).send({
                    message: 'El correo no puede cambiarse'
                });
            });

        } else {
            var userID = req.user.sub;
            //Buscar y actualizar documento
            User.findOneAndUpdate({ _id: userID }, params, { new: true }, (error, userUpdated) => {

                if (error || !userUpdated) {
                    //Devolver respuesta
                    return res.status(200).send({
                        status: 'success',
                        message: 'Error al actualizar datos'
                    });
                }

                //Devolver respuesta
                return res.status(200).send({
                    status: 'success',
                    user: userUpdated
                });
            });
        }




    },

    uploadAvatar: function(req, res) {
        //Configurar el modulo multiparty (router/user)

        var file = 'Archivo no enviado';
        //Recoger el fichero de la peticion
        if (!req.files) {
            return res.status(404).send({
                message: file
            });
        }

        //Conseguir el nombre y extension del archivo
        var file_path = req.files.file0.path;

        var path_split = file_path.split('\\');
        var file_name = path_split[2];

        var ex_split = file_name.split('\.');
        var file_ext = ex_split[1];

        //Comprobar extension( solo images), si no es valida borrar fichero

        if (file_ext != 'png' && file_ext != 'jpg' && file_ext != 'jpeg' && file_ext != 'gif') {

            fs.unlink(file_path, (err) => {
                return res.status(404).send({
                    message: 'Extension de archivo no valida'
                });
            });


        } else {
            //Sacar el id del usuario identificado
            var userId = req.user.sub;
            //Buscar y actualizar documentos
            User.findByIdAndUpdate({ _id: userId }, { image: file_name }, { new: true }, (error, userUpdate) => {
                //Devolver respuesta
                if (error || !userUpdate) {
                    return res.status(200).send({
                        message: 'Error al guardar al usuario'
                    });
                }

                return res.status(200).send({
                    status: 'success',
                    message: 'Avatar guardado correctamente',
                    userUpdate

                });
            });


        }


    }


};

module.exports = controller;