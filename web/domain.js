export const TYPES = {task:'Rotina',bill:'Fatura',appointment:'Consulta',service:'Serviço',goal:'Meta',meal:'Alimentação',exercise:'Exercício'};
export const CATEGORIES = ['Pessoal','Saúde','Finanças','Trabalho','Estudos','Família'];
export const today = () => localDate(new Date());
export function localDate(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function addDays(date,n) {const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+n);return localDate(d);}
export function nextMonth(date,anchorDay=Number(date.slice(-2))) {const [y,m,d]=date.split('-').map(Number);const last=new Date(y,m+1,0).getDate();return localDate(new Date(y,m,Math.min(anchorDay,last),12));}
export function money(n){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(n/100);}
export function percent(r){return r.target>0?Math.min(100,Math.max(0,Math.round((r.current||0)/r.target*100))):0;}
export function validDate(s){return /^\d{4}-\d{2}-\d{2}$/.test(s) && localDate(new Date(s+'T12:00:00'))===s;}
export function validCNPJ(value){
 const s=value.replace(/[.\/\-\s]/g,'').toUpperCase();
 if(!/^[A-Z\d]{12}\d{2}$/.test(s)||/^(.)\1{13}$/.test(s))return false;
 const digits=[...s].map(c=>c.charCodeAt(0)-48);
 for(let len=12;len<14;len++){let sum=0,w=len-7;for(let i=0;i<len;i++){sum+=digits[i]*w;if(--w<2)w=9;}const rem=sum%11;if(digits[len]!== (rem<2?0:11-rem))return false;}return true;
}
export function validateRecord(r){
 if(!TYPES[r.type])throw new Error('Tipo de registro inválido.');
 if(typeof r.title!=='string'||!r.title.trim()||r.title.length>160)throw new Error('Informe um título com até 160 caracteres.');
 if(!validDate(r.date))throw new Error('Informe uma data válida.');
 if(r.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))throw new Error('Horário inválido.');
 if(!Number.isSafeInteger(r.amount)||r.amount<0)throw new Error('Valor inválido.');
 if(!Number.isFinite(r.target)||!Number.isFinite(r.current)||r.target<0||r.current<0)throw new Error('Progresso inválido.');
 if(r.type==='goal'&&(r.target<=0||r.current>r.target))throw new Error('A meta deve ser positiva e o progresso não pode ultrapassá-la.');
 if(!Number.isInteger(r.anchorDay)||r.anchorDay<1||r.anchorDay>31)throw new Error('Dia de recorrência inválido.');
 if(!Number.isInteger(r.reminder)||r.reminder<0||r.reminder>43200)throw new Error('Antecedência inválida.');
 if(!['pending','doing','done'].includes(r.status))throw new Error('Status inválido.');
 if(!['none','daily','weekly','monthly'].includes(r.repeat))throw new Error('Recorrência inválida.');
 return r;
}
export function normalizeRecord(x){return validateRecord({id:String(x.id||crypto.randomUUID()).slice(0,100),type:x.type,title:String(x.title||'').trim(),date:x.date,anchorDay:Number(x.anchorDay||String(x.date).slice(-2)),time:String(x.time||''),amount:Number(x.amount||0),target:Number(x.target||0),current:Number(x.current||0),status:x.status||'pending',repeat:x.repeat||'none',category:CATEGORIES.includes(x.category)?x.category:'Pessoal',notes:String(x.notes||'').slice(0,2000),contact:String(x.contact||'').slice(0,160),companyId:String(x.companyId||'').slice(0,100),unit:String(x.unit||'').slice(0,30),reminder:Number(x.reminder ?? 60)});}
export function completeRecord(records,id){const item=records.find(r=>r.id===id);if(!item)return records;const wasDone=item.status==='done';const result=records.map(r=>r.id===id?{...r,status:wasDone?'pending':'done',current:r.type==='goal'&&!wasDone?r.target:r.current}:r);if(!wasDone&&item.repeat!=='none'){const date=item.repeat==='monthly'?nextMonth(item.date,item.anchorDay):addDays(item.date,item.repeat==='weekly'?7:1);if(!result.some(r=>r.title===item.title&&r.type===item.type&&r.date===date))result.push({...item,id:crypto.randomUUID(),date,status:'pending',current:0});}return result;}
function escapeICS(s){return String(s).replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');}
export function calendar(records){
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//MyRotine//PT-BR','CALSCALE:GREGORIAN','METHOD:PUBLISH'];
 for(const r of records.filter(r=>r.status!=='done')){const start=new Date(`${r.date}T${r.time||'09:00'}:00`);const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');lines.push('BEGIN:VEVENT',`UID:${escapeICS(r.id)}@myrotine.local`,`DTSTAMP:${stamp(new Date())}`,`DTSTART:${stamp(start)}`,`DTEND:${stamp(new Date(start.getTime()+3600000))}`,`SUMMARY:${escapeICS(r.title)}`);if(r.repeat!=='none'){let rule=`RRULE:FREQ=${{daily:'DAILY',weekly:'WEEKLY',monthly:'MONTHLY'}[r.repeat]}`;if(r.repeat==='monthly'&&r.anchorDay>28)rule+=';BYMONTHDAY='+Array.from({length:r.anchorDay-27},(_,i)=>28+i).join(',')+';BYSETPOS=-1';lines.push(rule);}lines.push('BEGIN:VALARM',`TRIGGER:-PT${Number.isFinite(r.reminder)?Math.max(0,Math.round(r.reminder)):60}M`,'ACTION:DISPLAY','DESCRIPTION:Lembrete MyRotine','END:VALARM','END:VEVENT');}
 lines.push('END:VCALENDAR');return lines.map(line=>{let out='',len=0;for(const ch of line){const size=new TextEncoder().encode(ch).length;if(len+size>73){out+='\r\n ';len=1;}out+=ch;len+=size;}return out;}).join('\r\n')+'\r\n';
}
export function blankState(){return {version:1,profile:{name:'',focus:'Uma coisa de cada vez.'},records:[],companies:[]};}
export function validateBackup(data){
 if(data?.version!==1||!Array.isArray(data.records)||!Array.isArray(data.companies)||data.records.length>10000||data.companies.length>1000)throw new Error('Backup inválido ou grande demais.');
 const records=data.records.map(normalizeRecord);if(new Set(records.map(r=>r.id)).size!==records.length)throw new Error('IDs duplicados no backup.');
 const companies=data.companies.map(c=>{if(!validCNPJ(String(c.cnpj))||!String(c.name||'').trim())throw new Error('Empresa inválida no backup.');return {id:String(c.id).slice(0,100),name:String(c.name).slice(0,160),cnpj:String(c.cnpj).slice(0,30)};});
 return {version:1,profile:{name:String(data.profile?.name||'').slice(0,60),focus:String(data.profile?.focus||'').slice(0,200)},records,companies};
}
export function demoState(){const date=today();return {version:1,profile:{name:'Alex',focus:'Fazer espaço para o que importa.'},companies:[{id:'demo-company',name:'Estúdio Horizonte',cnpj:'11.222.333/0001-81'}],records:[
 {type:'exercise',title:'Caminhada no parque',date,time:'07:00',category:'Saúde',status:'done',repeat:'daily'},
 {type:'task',title:'Planejar as prioridades do dia',date,time:'08:30',category:'Pessoal',status:'done'},
 {type:'service',title:'Identidade visual · Café Aurora',date,time:'10:00',category:'Trabalho',status:'doing',amount:240000,companyId:'demo-company',contact:'Café Aurora'},
 {type:'appointment',title:'Consulta de acompanhamento',date:addDays(date,1),time:'14:30',category:'Saúde',contact:'Clínica Jardim'},
 {type:'bill',title:'Cartão principal',date:addDays(date,2),amount:128450,category:'Finanças',repeat:'monthly'},
 {type:'meal',title:'Organizar as refeições da semana',date,time:'18:30',category:'Saúde'},
 {type:'goal',title:'Construir minha reserva',date:addDays(date,90),category:'Finanças',target:10000,current:4200,unit:'reais'},
 {type:'goal',title:'Ler com mais frequência',date:addDays(date,30),category:'Estudos',target:12,current:4,unit:'livros'},
 {type:'goal',title:'Ter tempo para me movimentar',date:addDays(date,7),category:'Saúde',target:5,current:3,unit:'dias'},
 {type:'service',title:'Landing page · Flor de Sal',date:addDays(date,5),category:'Trabalho',amount:180000,contact:'Flor de Sal',companyId:'demo-company'}
 ].map(r=>normalizeRecord({...r,id:crypto.randomUUID()}))};}
