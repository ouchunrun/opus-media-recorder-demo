/**
 * create audio element
 * @type {HTMLElement}
 */
let localAudio = document.createElement('audio');
localAudio.muted = true
localAudio.hidden = true
localAudio.autoplay = true
document.body.appendChild(localAudio)

let stream = null
let fileName = null;
let audioCtx = null
let audioRecorder = {}
let recordingDuration = 30000;   // 文件录制时间 30s
let recorderCallback = null

/**
 *  Non-standard options
 * @type {{OggOpusEncoderWasmPath: string}}
 */
const workerOptions = {
    OggOpusEncoderWasmPath: './OggOpusEncoder.wasm',
    // OggOpusEncoderWasmPath: 'https://cdn.jsdelivr.net/npm/opus-media-recorder@0.7.19/OggOpusEncoder.wasm'
};
window.MediaRecorder = OggOpusMediaRecorder;

/**
 * create MediaRecorder instance
 * @param stream
 * @param duration
 * @returns {*}
 */
function createMediaRecorder(stream, duration) {
    let options = {mimeType: 'audio/ogg'};
    let recorder = new MediaRecorder(stream, options, workerOptions, duration);
    let dataChunks = [];

    recorder.onstart = function(){
        dataChunks = [];
        console.log('Recorder started');
    }

    recorder.ondataavailable = function(e){
        dataChunks.push(e.data);
        console.log('Recorder data available ');
    }

    recorder.onstop = function(){
        console.log('recorder complete!')
        let blob = new Blob(dataChunks, {'type': recorder.mimeType});
        dataChunks = [];
        if(!blob.size){
            throw new Error('Exception: Blob is empty')
        }

        if(recorderCallback){
            recorderCallback(blob)
            audioRecorder = null
            audioCtx = null
            stream = null
            recorderCallback = null
        }
    }

    recorder.onpause = function(){
        console.log('Recorder paused')
    }

    recorder.onresume = function(){
        console.log('Recorder resumed')
    }

    recorder.onerror = function (error) {
        if (!error) {
            return;
        }

        if (!error.name) {
            error.name = 'UnknownError';
        }

        if (error.name.toString().toLowerCase().indexOf('invalidstate') !== -1) {
            console.error('The MediaRecorder is not in a state in which the proposed operation is allowed to be executed.', error);
        } else if (error.name.toString().toLowerCase().indexOf('notsupported') !== -1) {
            console.error('MIME type (', options.mimeType, ') is not supported.', error);
        } else if (error.name.toString().toLowerCase().indexOf('security') !== -1) {
            console.error('MediaRecorder security error', error);
        }

        // older code below
        else if (error.name === 'OutOfMemory') {
            console.error('The UA has exhaused the available memory. User agents SHOULD provide as much additional information as possible in the message attribute.', error);
        } else if (error.name === 'IllegalStreamModification') {
            console.error('A modification to the stream has occurred that makes it impossible to continue recording. An example would be the addition of a Track while recording is occurring. User agents SHOULD provide as much additional information as possible in the message attribute.', error);
        } else if (error.name === 'OtherRecordingError') {
            console.error('Used for an fatal error other than those listed above. User agents SHOULD provide as much additional information as possible in the message attribute.', error);
        } else if (error.name === 'GenericError') {
            console.error('The UA cannot provide the codec or recording option that has been requested.', error);
        } else {
            console.error('MediaRecorder Error', error);
        }

        console.error('Recorder encounters error:' + error.message)
        if (recorder._state !== 'inactive' && recorder._state !== 'stopped') {
            recorder.stop();
        }
    };

    return recorder
}

/**
 * 通过AudioContext.createMediaStreamDestination 生成文件流
 * @param buffer
 */
function createSoundSource(buffer) {
    let soundSource = audioCtx.createBufferSource();
    soundSource.buffer = buffer;
    let destination = audioCtx.createMediaStreamDestination();
    soundSource.connect(destination);
    soundSource.start();

    localAudio.srcObject = destination.stream
    stream = destination.stream
}

/**
 * Audio is ready to start playing
 */
localAudio.addEventListener('canplay', function () {
    try {
        localAudio.play()
        audioRecorder = createMediaRecorder(stream, recordingDuration)
        console.log('Creating MediaRecorder is successful, Start recorder...')
        audioRecorder.startRecording()
    }catch (e) {
        console.log(`MediaRecorder is failed: ${e.message}`);
        Promise.reject(new Error());
    }
})

/**
 * When the uploaded file is less than 30s, after audio playback ends, stop the recorder
 */
localAudio.addEventListener("ended", function () {
    if(audioRecorder._state !== 'inactive' && audioRecorder._state !== 'stopped'){
        audioRecorder.stopRecording()
    }
});

/**
 * Check available content types compatibility
 */
window.addEventListener('load', function() {
    if (OggOpusMediaRecorder === undefined) {
        console.error('No OpusMediaRecorder found');
    } else {
        let contentTypes = [
            'audio/wave',
            'audio/wav',
            'audio/ogg',
            'audio/ogg;codecs=opus',
            'audio/webm',
            'audio/webm;codecs=opus'
        ];
        contentTypes.forEach(function (type) {
            console.log(type + ' is ' + (MediaRecorder.isTypeSupported(type) ? 'supported' : 'NOT supported'));
        });
    }
}, false);

/**
 * Upload local audio file
 * 使用FileReader读取上传文件，转换为stream
 */
function recordToOgg (file, callback){
    console.log('Recorder audio file to ogg')
    fileName = file.name.replace(/\.[^\.]+$/, '')
    audioCtx = new AudioContext();
    let fileReader = new FileReader()
    fileReader.file = file;
    recorderCallback = callback

    fileReader.onload = function(e){
        console.log('file reade onload...')
        audioCtx.decodeAudioData(e.target.result).then(createSoundSource).catch(function (error) {
            console.error(error.toString())
        })
    }
    fileReader.readAsArrayBuffer(fileReader.file);
}