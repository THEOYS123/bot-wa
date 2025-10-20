const dns = require('dns').promises;
const commonSubs = ["www","mail","ftp","dev","test","webmail","vpn","m","api","admin","blog","shop",
"smtp","secure","ns1","ns2","imap","pop","database","db","mysql","postgres","sql",
"staging","beta","demo","support","status","auth","portal","help","static","assets",
"images","img","cdn","downloads","download","files","docs","documentation","git","gitlab",
"github","jira","confluence","monitor","monitoring","metrics","grafana","prometheus","kibana","elk",
"logs","analytics","search","sitemap","connect","gateway","proxy","mailer","mailer1","news",
"careers","jobs","hr","billing","payments","checkout","store","store-api","securepay","sandbox",
"sandbox-api","internal","intranet","manager","console","console-api","control","cluster","node","nodes",
"edge","api-v1","api-v2","v1","v2","v3","mobile","app","apps","mobile-api",
"push","websocket","ws","socket","socketio","realtime","rtmp","stream","streaming","video",
"media","cdn-edge","cdn1","cdn2","assets-cdn","static-cdn","images-cdn","auth-api","oauth","sso",
"login","logout","register","signup","users","user","profile","dashboard","adminpanel","admin-console",
"controlpanel","cpanel","webmin","whm","ispconfig","phpmyadmin","pma","adminer","sql-admin","mssql",
"mta","mailgun","sendgrid","ses","smtp-relay","imap-relay","relay","mx","mx1","mx2",
"ns","ns01","ns02","dns","dns1","dns2","whois","rdap","rdns","resolver",
"bastion","jump","jumpbox","jump-server","ssh","ssh-gateway","git-ssh","git-api","repo","repository",
"registry","docker-registry","docker","containers","k8s","kubernetes","helm","cluster-api","orchestrator","swarm",
"jenkins","ci","ci-cd","build","runner","drone","travis","circleci","artifacts","packages",
"pkg","npm","pypi","gems","composer","registry-npm","registry-pypi","release","deploy","deployment",
"preview","canary","preprod","pre-production","prod","production","live","hotfix","maintenance","maintenance-mode",
"health","healthcheck","heartbeat","uptime","statuspage","incident","alerts","notify","notification","sms",
"sms-gateway","voice","voip","sip","pbx","phone","fax","fax1","fax2","billing-api",
"payments-api","orders","order","cart","cart-api","catalog","inventory","warehouse","fulfillment","fulfilment",
"shipment","tracking","track","logistics","partner","partners","affiliate","crm","salesforce","hubspot",
"sales","marketing","ads","campaign","promo","offers","coupons","discount","landing","landingpage",
"lp","marketing-api","growth","seo","analytics-api","tagmanager","gtm","pixel","abtest","experiment",
"lab","research","rd","research-dev","sre","devops","ops","operator","service","svc",
"service-api","microservice","microservices","api-gateway","gateway-api","proxy-api","edge-api","reverse-proxy","cdn-proxy","waf",
"firewall","waffle","security","sec","secops","threat","ids","ips","siem","forensics",
"vault","secrets","kms","key","keymgmt","encrypt","encryption","certificate","cert","tls",
"ssl","https","http","tcp","udp","icmp","monitoring-api","observability","tracing","zipkin",
"jaeger","otel","opentelemetry","debug","profiling","pprof","trace","session","sessionstore","cache",
"redis","memcached","cache-api","cache1","nosql","mongo","cassandra","es","elasticsearch","search-api",
"autocomplete","suggest","recommend","recommendation","personalize","ml","ml-api","ai","ai-api","model",
"models","training","inference","notebook","jupyter","tensor","gpu","cuda","worker","task",
"queue","rabbitmq","kafka","stream-processor","etl","data","data-api","warehouse","dwh","bi",
"reports","reporting","export","import","sync","sync-api","backup","restore","snapshot","snapshot-api",
"collector","ingest","ingestion","pipeline","pipeline-api","scheduler","cron","tasks","jobs-api","batch",
"admin1","admin2","www1","www2","www3","web1","web2","web3","app1","app2",
"app3","shop1","shop2","shop3","mail1","mail2","ftp1","ftp2","old","legacy",
"archive","archives","backup-api","old-api","deprecated","retired","read","write","read-only","readonly",
"demo1","demo2","demo3","sandbox1","sandbox2","uat","uat-api","qa","qa-api","test1","test2",
"test3","experiment-api","alpha","beta-api","gamma","epsilon","zeta","omega","public","private",
"gov","secure-gov","edu","institute","university","research-portal","portal-dev","partner-api","vendor","vendors",
"shop-api","merchant","merchants","storefront","checkout-api","payment-gateway","fraud","fraud-detection","risk","compliance"];

exports.run = async function(arg){
  if(!arg) return 'Gunakan: /subfinder <domain>';
  const domain = arg.trim();
  const found = [];
  for(const s of commonSubs){
    try{
      const name = `${s}.${domain}`;
      const a = await dns.resolve(name, 'A').catch(()=>null);
      if(a && a.length) found.push({ sub: name, ips: a });
    }catch(e){}
  }
  return JSON.stringify(found, null, 2);
};
