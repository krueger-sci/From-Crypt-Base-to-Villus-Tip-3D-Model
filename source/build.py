import pathlib
d=pathlib.Path(__file__).parent
shell=(d/'shell.html').read_text()
three=(d/'three.min.js').read_text()
three=three.replace("console.warn('Scripts \"build/three.js\" and \"build/three.min.js\" are deprecated","void('")
app=(d/'app.js').read_text()
sim=(d/'sim.js').read_text()
out=shell.replace('<script>/*THREE*/</script>','<script>'+three.replace('</script','<\\/script')+'</script>').replace('/*SIM*/',sim).replace('/*APP*/',app)
(d.parent/'index.html').write_text(out)
print(len(out))
