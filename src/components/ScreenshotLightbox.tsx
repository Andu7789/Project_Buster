import { Modal } from './Modal'

export function ScreenshotLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <Modal title="Screenshot" onClose={onClose} wide>
      <img src={url} alt="Request screenshot" className="lightbox-image" />
    </Modal>
  )
}
