class MCWorker {
    constructor() {
        this.worker = new Worker('marching_cubes_worker.js');

        let messageCount = 0;

        let callbacks = new Map();

        this.worker.onmessage = (e) => {
            if (callbacks.has(e.data.id)) {
                callbacks.get(e.data.id)(e.data.msg);
                callbacks.delete(e.data.id);
            }
        }

        this.worker.onerror = (e) => {
            console.error(e);
        }

        let sendMessageCallback = (type, msg, transferrables, callback) => {
            callbacks.set(messageCount, callback);

            this.worker.postMessage({
                id: messageCount,
                type: type,
                msg: msg
            }, transferrables);

            messageCount++;
        }

        this._sendMessage = (type, msg, transferrables) => {
            return new Promise((f, r) => {
                sendMessageCallback(type, msg, transferrables, f);
            });
        }
    }

    loadVolume(volume, bbox = null) {
        return this._sendMessage('volume', {
            segmentation_buffer: volume.buffer,
            bbox: bbox
        }, [volume.buffer]).then(({segmentation_buffer}) => {
            return new volume.constructor(segmentation_buffer)
        });
    }

    generateMesh(id) {
        return this._sendMessage('mesh', {
            segId: id
        }).then(({triangles, positions, normals}) => {
            return {
                triangles: new Uint32Array(triangles),
                positions: new Float32Array(positions),
                normals: new Float32Array(normals)
            };
        });
    }
}

let segmentation;

// function segSet (x, y, z, val) {
//     segmentation[x + y * 256 + z * 256 * 256] = val;
// }

// segSet(1,1,1,1);


const body = document.querySelector('body');


const renderer = new THREE.WebGLRenderer();

// Set the scene size.
const WIDTH = window.innerWidth;
const HEIGHT = window.innerHeight;

// Set some camera attributes.
const VIEW_ANGLE = 45;
const ASPECT = WIDTH / HEIGHT;
const NEAR = 0.1;
const FAR = 100;

const camera =
    new THREE.PerspectiveCamera(
        VIEW_ANGLE,
        ASPECT,
        NEAR,
        FAR
);
camera.position.z = 3;

const scene = new THREE.Scene();

scene.add(camera);

const pointLight = new THREE.PointLight(0xFFFFFF);

pointLight.position.x = 10;
		pointLight.position.y = 50;
		pointLight.position.z = 130;

		// add to the scene
		scene.add(pointLight);

renderer.setSize(WIDTH, HEIGHT);

body.appendChild(renderer.domElement);


let myWorker = new MCWorker();

// load segmentation
fetch('./volume/segmentation').then((data) => {
    return data.arrayBuffer();
}).then((ab) => {
    segmentation = new Uint16Array(ab);
}).then(() => {
    // load segmentation
    return myWorker.loadVolume(segmentation);
}).then((returned_segmentation) => {
    // receive segmentation
    // generate mesh
    segmentation = returned_segmentation;
    return myWorker.generateMesh(910);
}).then(({triangles, positions, normals}) => {
    // generate geometry
    const geo = new THREE.BufferGeometry();
    geo.setIndex( new THREE.BufferAttribute(triangles, 1 ) );
    geo.addAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.addAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geo.normalizeNormals();

    return geo;
}).then((geo) => {
    // generate mesh, add to scene
    const material = new THREE.MeshLambertMaterial( { color: 0xffffff } );

    let mesh = new THREE.Mesh(geo, material);
    mesh.rotateY(Math.PI / 4);
    scene.add(mesh);
    renderer.render(scene, camera);
});
