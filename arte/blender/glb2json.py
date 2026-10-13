import sys, struct, json, base64
b = open(sys.argv[1], 'rb').read()
jl = struct.unpack_from('<I', b, 12)[0]
J = json.loads(b[20:20 + jl])
o = 20 + jl
bl = struct.unpack_from('<I', b, o)[0]
J['buffers'][0]['uri'] = 'data:application/octet-stream;base64,' + base64.b64encode(b[o + 8:o + 8 + bl]).decode()
json.dump(J, open(sys.argv[2], 'w'), separators=(',', ':'))
