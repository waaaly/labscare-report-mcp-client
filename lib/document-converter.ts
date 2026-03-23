
// 1. 使用 eval('require') 绕过 Webpack 的静态分析
const nativeRequire = eval('require');

// 2. 这里的加载完全不受 Webpack 干扰
const sharp = nativeRequire('sharp');
const { pdf } = nativeRequire('pdf-to-img');
const { convertWithOptions } = nativeRequire('libreoffice-convert');
const { promisify } = nativeRequire('node:util');
const path = nativeRequire('node:path');

const convert = promisify(convertWithOptions);
//‘D:/Program Files/LibreOffice/program/soffice.exe'
const sofficePath = path.resolve('C:/Program Files/LibreOffice/program/soffice.exe');
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
    // 1. 加载 PDF 文档句柄
    const document = await pdf(pdfBuffer, { scale: 2 });

    // 2. 获取具体某一页的 Buffer (注意：pageNumber 通常从 1 开始)
    const firstPageBuffer = await document.getPage(1);

    // 3. 将该页 Buffer 传给 Sharp 进行转换
    const jpgBuffer = await sharp(firstPageBuffer)
      .jpeg({ quality: 90 })
      .toBuffer();
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
