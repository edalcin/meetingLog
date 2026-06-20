<script>
  import { onMount, onDestroy } from 'svelte'
  import { Editor, Extension } from '@tiptap/core'
  import StarterKit from '@tiptap/starter-kit'
  import Link from '@tiptap/extension-link'
  import Placeholder from '@tiptap/extension-placeholder'

  let { content = $bindable(''), editable = true, placeholder = 'Digite aqui...', fill = false } = $props()

  let element = $state(null)
  let editor = $state(null)
  let tick = $state(0)

  let isBold    = $derived(tick > 0 && (editor?.isActive('bold') ?? false))
  let isItalic  = $derived(tick > 0 && (editor?.isActive('italic') ?? false))
  let isH1      = $derived(tick > 0 && (editor?.isActive('heading', { level: 1 }) ?? false))
  let isH2      = $derived(tick > 0 && (editor?.isActive('heading', { level: 2 }) ?? false))
  let isH3      = $derived(tick > 0 && (editor?.isActive('heading', { level: 3 }) ?? false))
  let isBullet  = $derived(tick > 0 && (editor?.isActive('bulletList') ?? false))
  let isOrdered = $derived(tick > 0 && (editor?.isActive('orderedList') ?? false))

  onMount(() => {
    editor = new Editor({
      element,
      extensions: [
        StarterKit,
        Link.configure({ openOnClick: false }),
        Placeholder.configure({ placeholder }),
        Extension.create({
          name: 'tabHandler',
          addKeyboardShortcuts() {
            return {
              Tab:       () => this.editor.commands.sinkListItem('listItem'),
              'Shift-Tab': () => this.editor.commands.liftListItem('listItem'),
            }
          },
        }),
      ],
      content,
      editable,
      onUpdate: ({ editor: ed }) => {
        content = ed.getHTML()
        tick++
      },
      onSelectionUpdate: () => {
        tick++
      },
      onTransaction: () => {
        tick++
      },
    })
  })

  onDestroy(() => {
    editor?.destroy()
  })

  export function getHTML() { return editor?.getHTML() ?? '' }
  export function setContent(html) { editor?.commands.setContent(html) }
</script>

<div class="{editable ? 'border border-gray-300 rounded-lg overflow-hidden bg-white' : ''} {fill ? 'flex flex-col flex-1 min-h-0' : ''}">
  {#if editable}
    <div class="flex gap-1 p-2 border-b border-gray-200 flex-wrap bg-gray-50">
      <button type="button"
        onclick={() => editor?.chain().focus().toggleBold().run()}
        class="px-2 py-1 text-sm rounded hover:bg-gray-200 font-bold transition-colors {isBold ? 'bg-gray-200' : ''}">B</button>
      <button type="button"
        onclick={() => editor?.chain().focus().toggleItalic().run()}
        class="px-2 py-1 text-sm rounded hover:bg-gray-200 italic transition-colors {isItalic ? 'bg-gray-200' : ''}">I</button>
      <div class="w-px bg-gray-300 mx-1"></div>
      <button type="button"
        onclick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
        class="px-2 py-1 text-xs rounded hover:bg-gray-200 font-semibold transition-colors {isH1 ? 'bg-gray-200' : ''}">H1</button>
      <button type="button"
        onclick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
        class="px-2 py-1 text-xs rounded hover:bg-gray-200 font-semibold transition-colors {isH2 ? 'bg-gray-200' : ''}">H2</button>
      <button type="button"
        onclick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
        class="px-2 py-1 text-xs rounded hover:bg-gray-200 font-semibold transition-colors {isH3 ? 'bg-gray-200' : ''}">H3</button>
      <div class="w-px bg-gray-300 mx-1"></div>
      <button type="button"
        onclick={() => editor?.chain().focus().toggleBulletList().run()}
        class="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors {isBullet ? 'bg-gray-200' : ''}">• Lista</button>
      <button type="button"
        onclick={() => editor?.chain().focus().toggleOrderedList().run()}
        class="px-2 py-1 text-xs rounded hover:bg-gray-200 transition-colors {isOrdered ? 'bg-gray-200' : ''}">1. Lista</button>
    </div>
  {/if}
  <div bind:this={element} class="{editable ? 'p-3' : 'prose-viewer p-0'} {fill ? 'flex-1 overflow-y-auto min-h-0' : 'min-h-[80px]'}"></div>
</div>
