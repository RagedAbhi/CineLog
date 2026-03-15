const { Resolver } = require('dns').promises;

async function resolve() {
  const resolver = new Resolver();
  resolver.setServers(['8.8.8.8', '1.1.1.1']); // Use Google / Cloudflare DNS

  try {
    const srvRecords = await resolver.resolveSrv('_mongodb._tcp.cineloguser.exbkqcm.mongodb.net');
    let txtOptions = '';
    try {
        const txtRecords = await resolver.resolveTxt('cineloguser.exbkqcm.mongodb.net');
        txtOptions = txtRecords.flat().join('&');
    } catch(e) {
        // sometimes there's no TXT record
    }
    
    const hosts = srvRecords.map(r => `${r.name}:${r.port}`).join(',');
    
    const baseUri = `mongodb://abhilashkhadanga_db_user:kqZNBYt3btcrKKQP@${hosts}/?ssl=true&replicaSet=atlas-13pivq-shard-0&authSource=admin&appName=CinelogUser`;
    
    let finalUri = baseUri;
    if (txtOptions) {
        finalUri = `mongodb://abhilashkhadanga_db_user:kqZNBYt3btcrKKQP@${hosts}/?${txtOptions}&appName=CinelogUser`;
    }
    
    console.log('---RESOLVED_URI---');
    console.log(finalUri);
    console.log('------------------');
  } catch(e) {
    console.error('Failed to resolve:', e.message);
  }
}

resolve();
