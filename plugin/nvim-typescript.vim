if exists('g:nvim_typescript#loaded')
  finish
endif
let g:nvim_typescript#loaded = 1
let g:nvim_typescript#ts_version = 'typescript@2.2.1'
let g:nvim_typescript#version = '1.0.0'

let g:nvim_typescript#javascript_support =
      \ get(g:, 'nvim_typescript#javascript_support', 0)
let g:nvim_typescript#max_completion_detail =
      \ get(g:, 'nvim_typescript#max_completion_detail', 25)
let g:nvim_typescript#type_info_on_hold =
      \ get(g:, 'nvim_typescript#type_info_on_hold', 0)
let g:nvim_typescript#signature_complete =
      \ get(g:, 'nvim_typescript#signature_complete', 0)

augroup nvim-typescript "{{{
  autocmd!

  if get(g:, 'nvim_typescript#type_info_on_hold', 1)
    if get(g:, 'nvim_typescript#javascript_support', 1)
       autocmd CursorHold *.ts,*.tsx,*.js,*.jsx TSType
    endif
     autocmd CursorHold *.ts,*.tsx TSType
  endif

  if get(g:, 'nvim_typescript#signature_complete', 1)
     autocmd CompleteDone *.ts,*.tsx TSSig
  endif

  if get(g:, 'nvim_typescript#javascript_support', 1)
    autocmd BufEnter *.ts,*.tsx,*.js,*.jsx call NvimTSEnter()
    autocmd BufWritePost *.ts,*.tsx,*.js,*.jsx call NvimTsSave()
  else
    autocmd BufEnter *.ts,*.tsx call NvimTSEnter()
    autocmd BufWritePost *.ts,*.tsx call NvimTsSave()
  endif

augroup end "}}}
