
// 1. 使用 eval('require') 绕过 Webpack 的静态分析
const nativeRequire = eval('require');

// 2. 这里的加载完全不受 Webpack 干扰
const sharp = nativeRequire('sharp');
const { pdf } = nativeRequire('pdf-to-img');
const { convertWithOptions } = nativeRequire('libreoffice-convert');
const { promisify } = nativeRequire('node:util');
const path = nativeRequire('node:path');

const convert = promisify(convertWithOptions);
const sofficePath = path.resolve('D:/Program Files/LibreOffice/program/soffice.exe');
export async function convertToPdf(buffer: Buffer, originalType: string): Promise<Buffer> {

  if (originalType === 'application/pdf') {
    return buffer;
  }
  // 确保 buffer 确实是原生的
  const nativeBuffer = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer as any);
  try {
    const pdfBuffer = await convert(nativeBuffer, '.pdf', undefined, {
      sofficeBinaryPaths: [sofficePath]
    });
    return pdfBuffer;
  } catch (error) {
    console.error('Failed to convert document to PDF:', error);
    throw new Error('Document conversion failed');
  }
}

export async function generateCoverImage(pdfBuffer: Buffer, fileName: string): Promise<Buffer> {
  try {
    const document = await pdf(pdfBuffer, { scale: 2 });
    let jpgBuffer
    // 获取第一页的迭代器
    jpgBuffer = await sharp(document[0])
      .resize(400)
      .webp({ quality: 80 })
      .toBuffer();
    // for await (const page of document) {
    //   // page 是一个图片的 Buffer (通常是 PNG)
    //   // 使用 sharp 进行二次压缩，转为 webp 存入 Minio
    //   jpgBuffer = await sharp(document[0])
    //     .resize(400)
    //     .webp({ quality: 80 })
    //     .toBuffer();
    // }
    // const os = require('os');
    // const path = require('path');
    // const fs = require('fs');

    // const tempDir = os.tmpdir();
    // const tempPdfPath = path.join(tempDir, `${fileName}-${Date.now()}.pdf`);
    // const tempJpgPath = path.join(tempDir, `${fileName}-${Date.now()}.jpg`);

    // fs.writeFileSync(tempPdfPath, pdfBuffer);

    // await execAsync(`convert -density 150 "${tempPdfPath}[0]" -quality 90 -strip "${tempJpgPath}"`);

    // let jpgBuffer = fs.readFileSync(tempJpgPath);

    // fs.unlinkSync(tempPdfPath);
    // fs.unlinkSync(tempJpgPath);

    const optimizedJpg = await sharp(jpgBuffer)
      .resize(400, 600, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({
        quality: 80,
        progressive: true
      })
      .toBuffer();

    return optimizedJpg;
  } catch (error) {
    console.error('Failed to generate cover image:', error);
    throw new Error('Cover image generation failed');
  }
}

export async function processDocument(
  buffer: Buffer,
  fileType: string,
  fileName: string
): Promise<{ pdfBuffer: Buffer; coverBuffer: Buffer | null }> {
  const pdfBuffer = await convertToPdf(buffer, fileType);

  try {
    const coverBuffer = await generateCoverImage(pdfBuffer, fileName);
    return { pdfBuffer, coverBuffer };
  } catch (error) {
    console.warn('Failed to generate cover image, continuing without it:', error);
    return { pdfBuffer, coverBuffer: null };
  }
}
