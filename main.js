import JSZip from 'jszip';

const upload = document.getElementById('upload');
const imagesContainer = document.getElementById('images');
const globalCaption = document.getElementById('globalCaption');
const downloadAllBtn = document.getElementById('downloadAll');
const modal = document.getElementById('modal');
const modalImg = document.getElementById('modalImg');

const imageItems = [];

downloadAllBtn.disabled = true;

modal.addEventListener('click', () => {
    modal.classList.remove('open');
});

downloadAllBtn.addEventListener('click', async () => {
    if (!imageItems.length) {
        return;
    }
    const zip = new JSZip();
    
    for (const item of imageItems) {
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

upload.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const itemObj = createImageItem(img, file.name);
                if (globalCaption.value) {
                    itemObj.setLeftCaption(globalCaption.value);
                }
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
});

function createImageItem(img, filename) {
    const item = document.createElement('div');
    item.className = 'image-item';
    
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
        
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        
        if (rotation === 90 || rotation === 270) {
            tempCanvas.width = originalImg.height;
            tempCanvas.height = originalImg.width;
        } else {
            tempCanvas.width = originalImg.width;
            tempCanvas.height = originalImg.height;
        }
        
        tempCtx.save();
        
        if (rotation === 90) {
            tempCtx.translate(tempCanvas.width, 0);
            tempCtx.rotate(90 * Math.PI / 180);
        } else if (rotation === 180) {
            tempCtx.translate(tempCanvas.width, tempCanvas.height);
            tempCtx.rotate(180 * Math.PI / 180);
        } else if (rotation === 270) {
            tempCtx.translate(0, tempCanvas.height);
            tempCtx.rotate(270 * Math.PI / 180);
        }
        
        tempCtx.drawImage(originalImg, 0, 0);
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
        
        canvas.toBlob((blob) => {
            currentBlob = blob;
            thumbnail.src = URL.createObjectURL(blob);
            download.href = thumbnail.src;
            download.download = `captioned-${filename}`;
            download.style.display = 'block';
            download.textContent = 'Download';
            downloadAllBtn.disabled = false;
        });
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
        currentFilename = caption ? `${caption.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.png` : `captioned-${filename}`;
        download.download = currentFilename;
        title.textContent = currentFilename;
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
    const getBlob = () => currentBlob;
    
    input.addEventListener('input', (e) => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
            setRightCaption(e.target.value);
        }, 300);
    });
    
    item.appendChild(removeBtn);
    item.appendChild(rotateBtn);
    item.appendChild(title);
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
        element: item
    };
    imageItems.push(itemObj);
    return itemObj;
}
