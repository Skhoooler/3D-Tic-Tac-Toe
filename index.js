import * as THREE from "./three/build/three.module.js";
import { OrbitControls } from "./three/examples/jsm/controls/OrbitControls.js";
import { OBJLoader } from "./three/examples/jsm/loaders/OBJLoader.js";
import { Audio } from "./three/src/audio/Audio.js";
// import { GUI } from "./three/examples/jsm/libs/dat.gui.module.js";

function main() {
    const manager = new THREE.LoadingManager();
    manager.onLoad = init;

    const progressbarElem = document.querySelector("#progressbar");
    manager.onProgress = (itemsLoaded, itemsTotal) => {
        progressbarElem.style.width = `${((itemsLoaded / itemsTotal) * 100) | 0}%`;
    };

    /* Loaders */
    const textureLoader = new THREE.TextureLoader(manager);
    const objectLoader = new OBJLoader(manager);

    var scene, camera, renderer;
    var controls;

    const time = new THREE.Clock();

    var raycaster = new THREE.Raycaster(); // This is used so THREE.js can detect where the mouse is hovering
    const mouse = new THREE.Vector2();

    var hoveredObject;

    const red = 0xff0000;
    const skyColor = 0xffffff;
    const grass = "./.resources/textures/Grass_001_COLOR.jpg";
    const marble = textureLoader.load("./.resources/textures/Red_Marble_002_COLOR.jpg");
    const table = "./.resources/blender/table.obj";

    /* Skybox texture */
    const positiveX = textureLoader.load(".resources/textures/field-skyboxes/Meadow/posx.jpg");
    const positiveY = textureLoader.load(".resources/textures/field-skyboxes/Meadow/posy.jpg");
    const positiveZ = textureLoader.load(".resources/textures/field-skyboxes/Meadow/posz.jpg");
    const negativeX = textureLoader.load(".resources/textures/field-skyboxes/Meadow/negx.jpg");
    const negativeY = textureLoader.load(".resources/textures/field-skyboxes/Meadow/negy.jpg");
    const negativeZ = textureLoader.load(".resources/textures/field-skyboxes/Meadow/negz.jpg");

    const pieceSize = 175;
    var playerSwitch = true;
    var gamePieceArray = [];
    var clickBoxArray = [];

    /*******************************************************************************************
     * Adds in artificial ground
     ******************************************************************************************/
    class Ground {
        constructor(size) {
            const texture = textureLoader.load(grass);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 4);
            const geometry = new THREE.PlaneGeometry(size, size);
            const material = new THREE.MeshLambertMaterial({
                map: texture,
                side: THREE.DoubleSide,
            });
            this.mesh = new THREE.Mesh(geometry, material);
            mesh.receiveShadow = true;
            mesh.rotation.x = Math.PI * -0.5;
            scene.add(mesh);
        }
    }

    /*******************************************************************************************
     * Imports the table object, applies the texture, and adds it to the scene.
     ******************************************************************************************/
    class Table {
        constructor(size, objectFile) {
            const material = new THREE.MeshPhongMaterial({ map: marble });

            objectLoader.load(objectFile, (mesh) => {
                mesh.scale.set(size, size, size);
                mesh.traverse(function (node) {
                    if (node.isMesh) {
                        node.material = material;
                    }
                });
                scene.add(mesh);
                return mesh;
            });
        }
    }

    /*******************************************************************************************
     * Unofficial Parent of the X & O pieces, as well as clickbox
     ******************************************************************************************/
    class GamePiece {
        constructor(col, row) {
            this.location = {
                col,
                row,
            };

            this.placed = false;
        }

        place(piece, col, row) {
            if (col == "A") {
                piece.position.x = -483;
            }
            if (col == "B") {
                piece.position.x = 0;
            }
            if (col == "C") {
                piece.position.x = 483;
            }
            if (row == 1) {
                piece.position.z = -483;
            }
            if (row == 2) {
                piece.position.z = 0;
            }
            if (row == 3) {
                piece.position.z = 483;
            }
        }
    }

    /*******************************************************************************************
     * Implements the ClickBoxes
     ******************************************************************************************/
    class ClickBox extends GamePiece {
        constructor(col, row, color = "red") {
            super(col, row);

            const geo = new THREE.PlaneGeometry(410, 410);
            const pieceMat = new THREE.MeshLambertMaterial({ color: color, opacity: 0.0, transparent: true, side: THREE.DoubleSide });

            var piece = new THREE.Mesh(geo, pieceMat);

            piece.position.y = 951;
            piece.rotation.x = Math.PI * -0.5;

            this.place(piece, col, row);

            piece.name = "clickbox";

            scene.add(piece);
            return piece;
        }

        getID() {
            return piece.id;
        }
    }

    /*******************************************************************************************
     * Class for the X Pieces
     ******************************************************************************************/
    class XPiece extends GamePiece {
        constructor(col, row, size = 175, color = red) {
            super(col, row);

            const geo = new THREE.BoxGeometry(0.3, 1, 0.1, 1, 1, 1, 1);
            const pieceMat = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });

            var leftX = new THREE.Mesh(geo, pieceMat);
            leftX.rotation.z = Math.PI / 2;

            var rightX = new THREE.Mesh(geo, pieceMat);
            leftX.rotation.z = -Math.PI / 2;

            var piece = new THREE.Group();
            piece.position.y = 2560;
            piece.add(leftX, rightX);
            piece.scale.set(size * 2, size * 2, size * 2);
            piece.rotation.z += Math.PI / 4;
            piece.rotation.x = Math.PI * -0.5;

            this.place(piece, col, row);

            piece.name = "xpiece";
            this.placed = true;

            scene.add(piece);
            return piece;
        }

        getID() {
            return piece.id;
        }
    }

    /*******************************************************************************************
     * Class for the O Pieces
     ******************************************************************************************/
    class OPiece extends GamePiece {
        constructor(col, row, size = 175, color = red) {
            super(col, row);

            let h = 0.2;
            let r = 1;
            let s = 100;
            let hs = 1;
            const innerG = new THREE.CylinderGeometry(r / 2, r / 2, h, s, hs, true);
            const topG = new THREE.RingGeometry(r / 2, r, s, hs);
            const bottomG = new THREE.RingGeometry(r / 2, r, s, hs);
            const outerG = new THREE.CylinderGeometry(r, r, h, s, hs, true);
            const pieceMat = new THREE.MeshLambertMaterial({ color: color, side: THREE.DoubleSide });

            var top = new THREE.Mesh(topG, pieceMat);
            top.rotation.x = Math.PI * -0.5;
            top.position.y += 0.1;

            var bottom = new THREE.Mesh(bottomG, pieceMat);
            bottom.rotation.x = Math.PI * -0.5;
            bottom.position.y -= 0.1;

            var out = new THREE.Mesh(outerG, pieceMat);
            var inn = new THREE.Mesh(innerG, pieceMat);

            var piece = new THREE.Group();
            piece.position.y = 2560;
            piece.add(top, bottom, out, inn);
            piece.scale.set(size, size, size);

            this.place(piece, col, row);

            piece.name = "opiece";
            this.placed = true;

            scene.add(piece);
            return piece;
        }

        getID() {
            return piece.id;
        }
    }

    /*******************************************************************************************
     * Handles the lighting for the game
     ******************************************************************************************/
    class Lighting {
        constructor() {
            // Add Directional Light
            const intensity = 1;
            const light = new THREE.DirectionalLight(skyColor, intensity);
            light.castShadow = true;
            light.position.set(100, 100, -100);
            light.target.position.set(-4, 0, -4);
            //scene.add(light);
            //scene.add(light.target);

            // Add Ambient Light
            const ambientLight = new THREE.AmbientLight(0x404040);
            //scene.add(ambientLight);
            const lighting = new THREE.Group();
            lighting.add(light, light.target, ambientLight);
            return lighting;
        }
    }

    /*******************************************************************************************
     * Handles the raycasting
     ******************************************************************************************/
    class PickHelper {
        constructor() {
            this.raycaster = new THREE.Raycaster();
            this.pickedObject = null;
            this.pickedOpacity = 0.0;
            this.pickedObjectSavedOpacity = 0.0;
        }
        pick(normalizedPosition, scene, camera) {
            // restore the color if there is a picked object
            if (this.pickedObject && this.pickedObject.material.name == "clickbox") {
                this.pickedObject.material.opacity = this.pickedObjectSavedOpacity;
                this.pickedObject = undefined;
            }

            // cast a ray through the frustum
            this.raycaster.setFromCamera(normalizedPosition, camera);
            // get the list of objects the ray intersected
            const intersectedObjects = this.raycaster.intersectObjects(scene.children);
            if (intersectedObjects.length) {
                this.pickedObject = intersectedObjects[0].object;
                if (this.pickedObject.material.name == "clickbox") {
                    this.pickedObjectSavedOpacity = this.pickedObject.material.opacity;
                    this.pickedObject.material.opacity = 0.5;
                }
            }
        }
    }

    /*******************************************************************************************
     * Creates and returns the skybox
     ******************************************************************************************/
    function createSkybox() {
        // Puts all of the loaded textures into an array
        const skyboxTextures = [positiveX, negativeX, positiveY, negativeY, positiveZ, negativeZ];

        // Takes all of the textures from the array above and converts it into
        // an array of meshes that only show up on the inside
        const skyboxMeshes = skyboxTextures.map((texture) => {
            return new THREE.MeshBasicMaterial({
                map: texture,
                side: THREE.BackSide,
            });
        });
        const skyboxGeo = new THREE.BoxGeometry(10000, 10000, 10000);
        skyboxGeo.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 2000, 0));

        return new THREE.Mesh(skyboxGeo, skyboxMeshes);
    }

    /*******************************************************************************************
     * Creates all of the Clickable Boxes and returns them in an array
     ******************************************************************************************/
    function createClickables() {
        return [
            new ClickBox("A", 1),
            new ClickBox("B", 1),
            new ClickBox("C", 1),
            new ClickBox("A", 2),
            new ClickBox("B", 2),
            new ClickBox("C", 2),
            new ClickBox("A", 3),
            new ClickBox("B", 3),
            new ClickBox("C", 3),
        ];
    }

    /*******************************************************************************************
     * Checks to see if a piece has already been placed in a certain spot
     ******************************************************************************************/
    function checkPiece(potentialPiece) {
        const valid = gamePieceArray.find(
            (placedPiece) => placedPiece.location.row === potentialPiece.location.row && placedPiece.location.col === potentialPiece.location.col
        );

        if (valid) {
            console.log("Potential Piece is valid");
            return true;
        } else return false;
    }

    /*******************************************************************************************
     * Handles what happens when you click on a valid location for a piece
     ******************************************************************************************/
    function onClick(event) {
        event.preventDefault();



        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        var intersects = raycaster.intersectObjects(scene.children, true);

        if (intersects[0].object.name === "clickbox") {
            let r;
            let c;
            let position = intersects[0].object.position;
            if (position.x < 0) {
                c = "A";
            }
            if (position.x == 0) {
                c = "B";
            }
            if (position.x > 0) {
                c = "C";
            }
            if (position.z < 0) {
                r = 1;
            }
            if (position.z == 0) {
                r = 2;
            }
            if (position.z > 0) {
                r = 3;
            }

            if (playerSwitch) {
                gamePieceArray.push(new XPiece(c, r));
                playerSwitch = false;
            } else {
                gamePieceArray.push(new OPiece(c, r));
                playerSwitch = true;
            }
            // load a sound and set it as the Audio object's buffer
            const audioLoader = new THREE.AudioLoader();
            audioLoader.load( './.resources/sound/piece_drop.wav', function( buffer ) {
                sound.setBuffer( buffer );
                sound.setLoop( false );
                sound.isPlaying = false;
                sound.setVolume( 0.5 );
                sound.play();
            });
        }
    }

    /*******************************************************************************************
     * Handles what happens when you hover over a valid location for a piece
     ******************************************************************************************/
    function hover(event) {
        event.preventDefault();

        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);

        var intersects = raycaster.intersectObjects(scene.children, true);

        if (hoveredObject != null && hoveredObject.name == "clickbox") {
            hoveredObject.material.opacity = 0.0;
            hoveredObject = null;
        }
        // if (intersects[0].object.name == "clickbox" && gamePieceArray.find((piece) => piece.getID() === intersects[0].object.id)) {
        if (intersects[0].object.name == "clickbox") {
            hoveredObject = intersects[0].object;
            intersects[0].object.material.opacity = 0.5;
        }
    }

    /*******************************************************************************************
     * Adds all of the main parts of THREE.js, like the scene, camera, etc
     ******************************************************************************************/
    // Create the main scene for the 3D drawing
    const canvas = document.querySelector("#c");
    scene = new THREE.Scene();

    // Every scene needs a camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 15000);

    // the renderer renders the scene using the objects, lights and camera
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Attach the threeJS renderer to the HTML page
    document.body.appendChild(renderer.domElement);

    controls = new OrbitControls(camera, canvas);
    controls.target.set(0, 960, 0);

    window.addEventListener("resize", () => {
        renderer.setSize(window.innerWidth, window.innerHeight);
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
    });

    camera.position.set(0, 2250, 750);
    camera.lookAt(new THREE.Vector3(0, 960, 0));

    const light = new Lighting();
    scene.add(light);

    //Add Background scene
    const skybox = createSkybox();
    scene.add(skybox);

    const board = new Table(350, table);

    // Initializes the gamepieces, places them in their default positions, and returns an array of all of the game Pieces
    clickBoxArray = createClickables();

    // create an AudioListener and add it to the camera
    const listener = new THREE.AudioListener();
    camera.add( listener );

    // create a global audio source
    const sound = new THREE.Audio( listener );


    var pickPosition = { x: 0, y: 0 };
    var pickHelper = new PickHelper();

    window.addEventListener("mousemove", hover, false);
    window.addEventListener("click", onClick, false);

    // Used for Three.js Inspector
    window.scene = scene;
    window.THREE = THREE;

    renderer.render(scene, camera);

    init();
    animate();

    // ctrl + shift + i in the browser brings up developer tools & shows error messages

    // Start Script
    function init() {
        /*******************************************************************************************
         * This section changes the lighting and background
         ******************************************************************************************/
        // hide the loading bar
        const loadingElem = document.querySelector("#loading");
        loadingElem.style.display = "none";
    }
    // End script

    /*******************************************************************************************
     * This is the game/animation loop
     * It is called ~60 times a second
     ******************************************************************************************/
    function animate() {
        // This updates orbit controls every frame
        controls.update();

        // This allows the pieces to drop down. The X and O pieces start out higher than their original
        // position of 960 now.
        // If you change the speed, be sure it is a clean divisor of the starting y position minus 960
        // For example, right now it's 2560 - 960 which equals 1600. The speed of 400 divides cleanly into
        // 1600, meaning it will end nicely on 960 instead of some other weird position
        var i;
        for (i = 0; i < gamePieceArray.length; i++) {
            if (gamePieceArray[i].position.y > 960) {
                gamePieceArray[i].position.y -= 400;
            }
        }

        pickHelper.pick(pickPosition, scene, camera);

        render();
    }

    function render() {
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
}
main();
