package thumbnail

import (
	"bytes"
	_ "embed"
	"fmt"
	"image"
	"image/jpeg"
	_ "image/png"
	"io"
	"os"

	"golang.org/x/image/draw"
)

//go:embed pdf-icon.png
var pdfIconPNG []byte

const (
	thumbSize = 200
	thumbQuality = 85
)

// GenerateJPEG decodes a PNG or JPEG from src, scales it to a 200×200 cover
// thumbnail, and writes a JPEG to dst. Returns an error if the image cannot
// be decoded or the thumbnail cannot be written.
func GenerateJPEG(dst io.Writer, src io.Reader) error {
	img, _, err := image.Decode(src)
	if err != nil {
		return fmt.Errorf("thumbnail: decode: %w", err)
	}

	thumb := scaleCover(img, thumbSize, thumbSize)

	return jpeg.Encode(dst, thumb, &jpeg.Options{Quality: thumbQuality})
}

// GenerateJPEGFromFile reads the file at path, generates a JPEG thumbnail,
// and writes it to outPath.
func GenerateJPEGFromFile(srcPath, dstPath string) error {
	f, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("thumbnail: open src: %w", err)
	}
	defer f.Close()

	var buf bytes.Buffer
	if err := GenerateJPEG(&buf, f); err != nil {
		return err
	}

	out, err := os.Create(dstPath)
	if err != nil {
		return fmt.Errorf("thumbnail: create dst: %w", err)
	}
	defer out.Close()

	_, err = io.Copy(out, &buf)
	return err
}

// PDFIconBytes returns the embedded PDF icon PNG bytes.
// Used by the thumbnail endpoint when the file is a PDF.
func PDFIconBytes() []byte {
	return pdfIconPNG
}

// scaleCover scales img to exactly w×h pixels, cropping to cover (like CSS
// background-size: cover) using Catmull-Rom resampling.
func scaleCover(src image.Image, w, h int) image.Image {
	srcBounds := src.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()

	// Determine scale factor so the image covers w×h.
	scaleW := float64(w) / float64(srcW)
	scaleH := float64(h) / float64(srcH)
	scale := scaleW
	if scaleH > scaleW {
		scale = scaleH
	}

	scaledW := int(float64(srcW)*scale + 0.5)
	scaledH := int(float64(srcH)*scale + 0.5)

	// Scale to the cover size first.
	scaled := image.NewRGBA(image.Rect(0, 0, scaledW, scaledH))
	draw.CatmullRom.Scale(scaled, scaled.Bounds(), src, srcBounds, draw.Over, nil)

	// Crop to w×h from center.
	offX := (scaledW - w) / 2
	offY := (scaledH - h) / 2
	cropped := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(cropped, cropped.Bounds(), scaled, image.Pt(offX, offY), draw.Src)

	return cropped
}
