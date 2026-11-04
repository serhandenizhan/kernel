import { ReactNodeViewRenderer } from '@tiptap/react'
import { PdfEmbedSchema } from './WikiLink'
import { PdfEmbedView } from '../ui/PdfEmbedView'

// Gömülü PDF (![[attachments/x.pdf]]) görüntüleyicili düğüm
export const PdfEmbed = PdfEmbedSchema.extend({
  addNodeView() {
    return ReactNodeViewRenderer(PdfEmbedView)
  }
})
