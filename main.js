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

    loadVolume(volume, bbox) {
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


let myWorker = new MCWorker();

let segmentation = new Uint16Array(256 * 256 * 256);

function segSet (x, y, z, val) {
    segmentation[x + y * 256 + z * 256 * 256] = val;
}

segSet(1,1,1,1);

// segmentation is now bad
myWorker.loadVolume(segmentation, new Uint8Array([
    0,0,0,0,0,0,1,1,1,2,2,2
])).then((returned_segmentation) => {
    segmentation = returned_segmentation; // segmentation good again
    myWorker.generateMesh(1).then(({triangles, positions, normals}) => {
        console.log(triangles, positions, normals);
    });
});
