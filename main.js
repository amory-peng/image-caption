import JSZip from 'jszip';
import imageCompression from 'browser-image-compression';

const upload = document.getElementById('upload');
const uploadFilesBtn = document.getElementById('uploadFiles');
const uploadFolderBtn = document.getElementById('uploadFolder');
const imagesContainer = document.getElementById('images');
const globalCaption = document.getElementById('globalCaption');
const downloadAllBtn = document.getElementById('downloadAll');
const compressingIndicator = document.getElementById('compressing');
const fileList = document.getElementById('fileList');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modalImg');
const cropModal = document.getElementById('cropModal');
const cropCanvas = document.getElementById('cropCanvas');
const cropApply = document.getElementById('cropApply');
const cropCancel = document.getElementById('cropCancel');

let currentCropItem = null;
let cropStart = null;
let cropEnd = null;
let cropRect = null;
let cropBaseImageData = null;

const imageItems = [];

downloadAllBtn.disabled = true;

modal.addEventListener('click', () => {
    modal.classList.remove('open');
});

cropCancel.addEventListener('click', () => {
    cropModal.classList.remove('open');
    currentCropItem = null;
    cropStart = null;
    cropEnd = null;
    cropRect = null;
    cropBaseImageData = null;
});

cropCanvas.addEventListener('click', (e) => {
    const rect = cropCanvas.getBoundingClientRect();
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;
    const point = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
    
    if (!cropStart) {
        cropStart = point;
    } else if (!cropRect) {
        cropEnd = point;
        const scaleX = currentCropItem.img.width / cropCanvas.width;
        const scaleY = currentCropItem.img.height / cropCanvas.height;
        cropRect = {
            x: Math.min(cropStart.x, cropEnd.x) * scaleX,
            y: Math.min(cropStart.y, cropEnd.y) * scaleY,
            width: Math.abs(cropEnd.x - cropStart.x) * scaleX,
            height: Math.abs(cropEnd.y - cropStart.y) * scaleY
        };
    } else {
        cropStart = point;
        cropEnd = null;
        cropRect = null;
        const ctx = cropCanvas.getContext('2d');
        ctx.putImageData(cropBaseImageData, 0, 0);
    }
});

cropCanvas.addEventListener('mousemove', (e) => {
    if (!cropStart || cropRect) return;
    const rect = cropCanvas.getBoundingClientRect();
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;
    cropEnd = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
    drawCropPreview();
});

cropApply.addEventListener('click', () => {
    if (currentCropItem && cropRect) {
        currentCropItem.applyCrop(cropRect);
        cropModal.classList.remove('open');
        currentCropItem = null;
        cropStart = null;
        cropEnd = null;
        cropRect = null;
        cropBaseImageData = null;
    }
});

function drawCropPreview() {
    if (!currentCropItem || !cropStart || !cropEnd) return;
    const ctx = cropCanvas.getContext('2d');
    
    ctx.putImageData(cropBaseImageData, 0, 0);
    
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const width = Math.abs(cropEnd.x - cropStart.x);
    const height = Math.abs(cropEnd.y - cropStart.y);
    
    ctx.clearRect(x, y, width, height);
    ctx.drawImage(currentCropItem.img, 
        x * (currentCropItem.img.width / cropCanvas.width),
        y * (currentCropItem.img.height / cropCanvas.height),
        width * (currentCropItem.img.width / cropCanvas.width),
        height * (currentCropItem.img.height / cropCanvas.height),
        x, y, width, height
    );
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
}

uploadFilesBtn.addEventListener('click', () => {
    upload.removeAttribute('webkitdirectory');
    upload.click();
});

uploadFolderBtn.addEventListener('click', () => {
    upload.setAttribute('webkitdirectory', '');
    upload.click();
});

downloadAllBtn.addEventListener('click', async () => {
    if (!imageItems.length) {
        return;
    }
    const zip = new JSZip();
    
    for (const item of imageItems) {
        if (!item) continue;
        const blob = await item.getBlob();
        if (blob) {
            zip.file(item.filename, blob);
        }
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'captioned-images.zip';
    a.click();
    URL.revokeObjectURL(url);
});

let globalDebounce;
globalCaption.addEventListener('input', (e) => {
    clearTimeout(globalDebounce);
    globalDebounce = setTimeout(() => {
        const caption = e.target.value;
        let index = 0;
        
        const processBatch = () => {
            const batchSize = 10;
            const end = Math.min(index + batchSize, imageItems.length);
            
            for (let i = index; i < end; i++) {
                imageItems[i].setLeftCaption(caption);
            }
            
            index = end;
            
            if (index < imageItems.length) {
                setTimeout(processBatch, 0);
            }
        };
        
        processBatch();
    }, 500);
});

upload.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).filter(file => 
        file.type.startsWith('image/')
    );
    
    if (files.length === 0) return;
    
    compressingIndicator.style.display = 'block';
    
    fileList.innerHTML = '';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const listItem = document.createElement('div');
        listItem.innerHTML = `<span class="spinner">⏳</span> ${file.name}`;
        listItem.dataset.originalName = file.name;
        listItem.dataset.order = i;
        fileList.appendChild(listItem);
        
        let processedFile = file;
        
        if (file.size > 1024 * 1024) {
            try {
                processedFile = await imageCompression(file, {
                    maxSizeMB: 1,
                    useWebWorker: true
                });
            } catch (e) {
                console.error('Compression failed:', e);
            }
        }
        
        listItem.querySelector('.spinner').textContent = '✓';
        
        const reader = new FileReader();
        const loadPromise = new Promise((resolve) => {
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const itemObj = createImageItem(img, file.name, processedFile.size, listItem, i, processedFile);
                    if (globalCaption.value) {
                        itemObj.setLeftCaption(globalCaption.value);
                    }
                    resolve();
                };
                img.src = event.target.result;
            };
        });
        reader.readAsDataURL(processedFile);
        await loadPromise;
    }
    
    compressingIndicator.style.display = 'none';
    downloadAllBtn.disabled = false;
});

function createImageItem(img, filename, originalSize, listItem, order, originalFile) {
    const item = document.createElement('div');
    item.className = 'image-item';
    item.style.order = order;
    
    const removeBtn = document.createElement('button');
    removeBtn.textContent = '×';
    removeBtn.className = 'remove-btn';
    removeBtn.addEventListener('click', () => {
        const index = imageItems.findIndex(i => i.element === item);
        if (index > -1) imageItems.splice(index, 1);
        item.remove();
        if (imageItems.length === 0) downloadAllBtn.disabled = true;
    });
    
    const rotateBtn = document.createElement('button');
    rotateBtn.textContent = '↻';
    rotateBtn.className = 'rotate-btn';
    
    const cropBtn = document.createElement('button');
    cropBtn.textContent = '✂';
    cropBtn.className = 'crop-btn';
    
    let rotation = 0;
    const originalImg = img;
    const rotatedImages = { 0: img };
    
    rotateBtn.addEventListener('click', () => {
        rotation = (rotation + 90) % 360;
        
        if (rotatedImages[rotation]) {
            img = rotatedImages[rotation];
            thumbnail.src = img.src;
            if (leftCaption || rightCaption) {
                queueRender();
            }
            return;
        }
        
        const baseImg = rotatedImages[(rotation - 90 + 360) % 360] || img;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        tempCanvas.width = baseImg.height;
        tempCanvas.height = baseImg.width;
        
        tempCtx.save();
        tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        tempCtx.rotate(90 * Math.PI / 180);
        tempCtx.drawImage(baseImg, -baseImg.width / 2, -baseImg.height / 2);
        tempCtx.restore();
        
        tempCanvas.toBlob((blob) => {
            const newImg = new Image();
            newImg.onload = () => {
                rotatedImages[rotation] = newImg;
                img = newImg;
                thumbnail.src = newImg.src;
                if (leftCaption || rightCaption) {
                    queueRender();
                }
            };
            newImg.src = URL.createObjectURL(blob);
        });
    });
    
    const title = document.createElement('div');
    title.textContent = filename;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '0.5rem';
    
    const filesize = document.createElement('div');
    filesize.style.fontSize = '0.875rem';
    filesize.style.color = '#666';
    filesize.style.marginBottom = '0.5rem';
    filesize.textContent = `${(originalSize / (1024 * 1024)).toFixed(2)} MB`;
    
    const thumbnail = document.createElement('img');
    thumbnail.src = img.src;
    thumbnail.style.marginBottom = '0.5rem';
    
    thumbnail.addEventListener('click', () => {
        modalImg.src = thumbnail.src;
        modal.classList.add('open');
    });
    
    const rightTitle = document.createElement('div');
    rightTitle.className = 'section-title';
    rightTitle.textContent = 'Individual Caption:';
    
    const input = document.createElement('textarea');
    input.placeholder = 'Enter caption';
    input.rows = 2;
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    const download = document.createElement('a');
    download.style.display = 'none';
    
    let leftCaption = '';
    let rightCaption = '';
    let debounce;
    let currentBlob = null;
    let renderQueued = false;
    
    const render = () => {
        renderQueued = false;
        
        const padding = 40;
        const fontSize = Math.max(24, img.width * 0.03);
        const maxWidth = img.width * 0.5 - padding;
        
        ctx.font = `${fontSize}px sans-serif`;
        
        const leftLines = leftCaption ? getLines(ctx, leftCaption, maxWidth) : [];
        const rightLines = rightCaption ? getLines(ctx, rightCaption, maxWidth) : [];
        const maxLines = Math.max(leftLines.length, rightLines.length, 1);
        const captionHeight = maxLines * fontSize + padding * 2;
        
        canvas.width = img.width;
        canvas.height = img.height + captionHeight;
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.drawImage(img, 0, 0);
        
        ctx.fillStyle = 'black';
        ctx.fillRect(0, img.height, canvas.width, captionHeight);
        
        ctx.fillStyle = 'white';
        ctx.font = `${fontSize}px sans-serif`;
        ctx.textBaseline = 'middle';
        
        if (leftCaption) {
            ctx.textAlign = 'left';
            drawLines(ctx, leftLines, padding, img.height + captionHeight / 2, fontSize);
        }
        
        if (rightCaption) {
            ctx.textAlign = 'right';
            drawLines(ctx, rightLines, canvas.width - padding, img.height + captionHeight / 2, fontSize);
        }
        
        canvas.toBlob(async (blob) => {
            const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);
            filesize.textContent = `${sizeMB} MB`;
            
            currentBlob = blob;
            thumbnail.src = URL.createObjectURL(blob);
            download.href = thumbnail.src;
            download.download = currentFilename;
            download.style.display = 'block';
            download.textContent = 'Download';
        }, 'image/jpeg', 0.9);
    };
    
    const queueRender = () => {
        if (!renderQueued) {
            renderQueued = true;
            requestAnimationFrame(render);
        }
    };
    
    let currentFilename = `captioned-${filename}`;
    
    const setLeftCaption = (caption) => {
        leftCaption = caption;
        queueRender();
    };
    
    const setRightCaption = (caption) => {
        rightCaption = caption;
        currentFilename = caption ? `${caption.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.jpg` : `captioned-${filename.replace(/\.[^.]+$/, '.jpg')}`;
        download.download = currentFilename;
        title.textContent = currentFilename;
        if (listItem) {
            const spinner = listItem.querySelector('.spinner');
            listItem.innerHTML = `${spinner ? spinner.outerHTML : ''} ${currentFilename}`;
        }
        queueRender();
    };
    
    const getLines = (ctx, text, maxWidth) => {
        const paragraphs = text.split('\n');
        const lines = [];
        
        for (let paragraph of paragraphs) {
            const words = paragraph.split(' ');
            let line = '';
            
            for (let word of words) {
                const testLine = line + word + ' ';
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && line !== '') {
                    lines.push(line);
                    line = word + ' ';
                } else {
                    line = testLine;
                }
            }
            lines.push(line);
        }
        
        return lines;
    };
    
    const drawLines = (ctx, lines, x, y, lineHeight) => {
        const startY = y - ((lines.length - 1) * lineHeight) / 2;
        lines.forEach((line, i) => {
            ctx.fillText(line.trim(), x, startY + i * lineHeight);
        });
    };
    
    const triggerDownload = () => {
        if (currentBlob) {
            download.click();
        }
    };
    const getBlob = () => currentBlob || originalFile;
    
    const applyCrop = (rect) => {
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = rect.width;
        tempCanvas.height = rect.height;
        tempCtx.drawImage(img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
        
        tempCanvas.toBlob((blob) => {
            const newImg = new Image();
            newImg.onload = () => {
                img = newImg;
                rotation = 0;
                Object.keys(rotatedImages).forEach(key => delete rotatedImages[key]);
                rotatedImages[0] = newImg;
                thumbnail.src = newImg.src;
                queueRender();
            };
            newImg.src = URL.createObjectURL(blob);
        });
    };
    
    cropBtn.addEventListener('click', () => {
        currentCropItem = { img, applyCrop };
        cropCanvas.width = Math.min(img.width, 800);
        cropCanvas.height = (img.height / img.width) * cropCanvas.width;
        const ctx = cropCanvas.getContext('2d');
        ctx.drawImage(img, 0, 0, cropCanvas.width, cropCanvas.height);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
        cropBaseImageData = ctx.getImageData(0, 0, cropCanvas.width, cropCanvas.height);
        cropModal.classList.add('open');
        cropStart = null;
        cropEnd = null;
        cropRect = null;
    });
    
    input.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            setRightCaption(e.target.value);
        }, 300);
    });
    
    item.appendChild(removeBtn);
    item.appendChild(rotateBtn);
    item.appendChild(cropBtn);
    item.appendChild(title);
    item.appendChild(filesize);
    item.appendChild(thumbnail);
    item.appendChild(rightTitle);
    item.appendChild(input);
    item.appendChild(download);
    imagesContainer.appendChild(item);
    
    const itemObj = { 
        setLeftCaption, 
        setRightCaption, 
        download: triggerDownload, 
        getBlob, 
        get filename() { return currentFilename; },
        element: item,
        order: order
    };
    imageItems[order] = itemObj;
    return itemObj;
}
