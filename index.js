const path = require('path')
const Promise = require('bluebird')
const fs = require('fs')
const ini = require('multi-ini')
Promise.promisifyAll(fs)

let formats = ['png','svg'/** /,'xpm'/**/]

module.exports = function iconSearch(icon, size='32', scale='1', theme=''){
  if(!themes)
    return scanThemes().then(()=>iconSearch(icon,size,scale,theme))
  return Promise.resolve(FindIcon(icon,size,scale,theme))
}
let themes

function scanThemes(){
  return getThemes()
    .then(t=>themes = t)
    .then(themes=>{
      themes.forEach(theme=>{
        try{
          let index = ini.read(path.join(theme.file,'index.theme'))
          let def = index['Icon Theme']
          theme.def = def
          theme.index = {}
          theme.appIndex = {}
          def.Directories.split(',').forEach(dir=>{
            theme.index[dir] = index[dir]
            if(dir.match(/apps/))
              theme.appIndex[dir] = index[dir]
          })
        }catch(err){}
      })
    })
    .then(()=>themes)
}

function log(d){
  console.log(d)
  return d
}

function getThemes(){
  let themes = []
  let paths = []
  paths.push(path.join(process.env.HOME,'.icons'))
  if(process.env.XDG_DATA_DIRS)
    paths.push(...process.env.XDG_DATA_DIRS.split(':').map(f=>path.join(f,'icons')))
  // paths.push('/usr/share/pixmaps')
  
  return Promise.all(paths.map(fpath=>{
    return fs.readdirAsync(fpath)
      .then(files=>files.map(f=>path.join(fpath,f)))
      .then(files=>{
        let ps = files.map(file=>fs.statAsync(file)
          .then(stat=>({ file, stat })))
        return Promise.all(ps)
      })
      .then(files=>files.filter(file=>file.stat.isDirectory()))
      .then(files=>files.map(f=>{
        f.name = path.basename(f.file)
        return f
      }))
      .then(files=>themes.push(...files))
      .catch(()=>{})
  })).then(()=>themes)
}

// The exact algorithm (in pseudocode) for looking up an icon in a theme (if the implementation supports SVG) is:

function FindIcon(icon, size, scale, theme) {
  if(theme){
    let filename = FindIconHelper(icon, size, scale, theme);
    if (filename)
      return filename
  }
  let filename = FindIconHelper(icon, size, scale, "hicolor");
  if (filename)
    return filename

  return LookupFallbackIcon(icon)
}
function FindIconHelper(icon, size, scale, theme) {
  theme = themes.find(t=>t.name == theme)
  if(!theme) return null
  let filename = LookupIcon (icon, size, scale, theme)
  if(filename) return filename

  // if theme has parents
  //   parents = theme.parents

  // for parent in parents {
  //   filename = FindIconHelper (icon, size, scale, parent)
  //   if filename != none
  //     return filename
  // }
  return null
}

function tryFile(file){
  try{
    fs.accessSync(file)
    return true
  }catch(e){
    return false
  }
}

// With the following helper functions:
function LookupIcon (iconname, size, scale, theme) {  
  for(let subdirName in theme.appIndex){
    let subdir = theme.appIndex[subdirName]
    if(DirectoryMatchesSize(subdir, size, scale)) {
      for(let i in formats){
        let ext = formats[i]
        let file = path.join(`${path.join(theme.file,subdirName,iconname)}.${ext}`)
        if(tryFile(file)) return file
      }
    }
    
  }
  let minimal_size = 2048
  let closest = ''
  for(let subdirName in theme.appIndex){
    let subdir = theme.appIndex[subdirName]
    if(DirectoryMatchesSize(subdir, size, scale)) {
      for(let i in formats){
        let ext = formats[i]
        let file = path.join(`${path.join(theme.file,subdirName,iconname)}.${ext}`)
        if(tryFile(file) && DirectorySizeDistance(subdir, size, scale) < minimal_size){
          closest = file
          minimal_size = DirectorySizeDistance(subdir, size, scale)
        }
      }
    }
  }
  return closest || null
}

/**/
function LookupFallbackIcon (iconname) {
  for(let i in formats){
    let file = `/usr/share/pixmaps/${iconname}.${formats[i]}`
    if(tryFile(file))
      return file
  }
  /** /
  for each directory in $(basename list) {
    for extension in ("png", "svg", "xpm") {
      if exists directory/iconname.extension
        return directory/iconname.extension
    }
  }
  /**/
  return null
}
/**/
function DirectoryMatchesSize(subdir, iconsize, iconscale) {
  // read Type and size data from subdir
  // console.log('DirectoryMatchesSize',subdir,iconsize,iconscale)
  if(subdir.Scale && subdir.Scale != iconscale)
     return false
  if(subdir.Type == 'Fixed')
    return subdir.Size == iconsize
  if(subdir.Type == 'Scaled')
    return subdir.MinSize <= iconsize && iconsize <= MaxSize
  if(subdir.Type == 'Threshold')
    return subdir.Size - (subdir.Threshold || 0) <= iconsize && iconsize <= subdir.Size + (subdir.Threshold || 0)
}
/**/
function DirectorySizeDistance(subdir, iconsize, iconscale) {
  //read Type and size data from subdir
  if(subdir.Type == 'Fixed')
    return abs(subdir.Size*subdir.Scale - iconsize*iconscale)
  if(subdir.Type == 'Scaled'){
    if(iconsize*iconscale < MinSize*subdir.Scale)
        return MinSize*subdir.Scale - iconsize*iconscale
    if(iconsize*iconscale > MaxSize*subdir.Scale)
        return iconsize*iconscale - MaxSize*subdir.Scale
    return 0
  }
  if(subdir.Type == 'Threshold'){
    if(iconsize*iconscale < (subdir.Size - subdir.Threshold)*subdir.Scale)
        return subdir.MinSize*subdir.Scale - iconsize*iconscale
    if(iconsize*iconsize > (subdir.Size + subdir.Threshold)*subdir.Scale)
        return iconsize*iconsize - subdir.MaxSize*subdir.Scale
    return 0
  }
}