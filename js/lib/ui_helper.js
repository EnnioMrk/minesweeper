/* exported uih_manager */
/* global uih_scripts_init */
class uih_template {
    constructor(type, content) {
        this.type = type;
        this.content = content;
    }
}

class uih_manager {
    constructor(game, wrapper) {
        this.game = game;
        this.wrapper = wrapper;
        this.onloads = new Map();
        this.offloads = new Map();
    }
    get_all_templates() {
        return new Promise((resolve, reject) => {
            fetch('/ui/templates.html')
                .then((response) => response.text())
                .then((text) =>
                    new DOMParser().parseFromString(text, 'text/html')
                )
                .then((doc) => {
                    let templates = Array.from(
                        doc.querySelectorAll('template')
                    );
                    //id is the id of the template
                    this.templates = templates.map((t) => {
                        return new uih_template(
                            t.id,
                            t.content.cloneNode(true)
                        );
                    });
                    resolve();
                })
                .catch((error) => {
                    reject(error);
                });
        });
    }
    register_page(element, id, onload, offload) {
        element.dataset.page_id = id;
        if (onload) this.onloads.set(id, onload);
        if (offload) this.offloads.set(id, offload);
    }
    change_page(id) {
        let page = this.wrapper.querySelector(`[data-page_id="${id}"]`);
        if (!page) {
            console.error('Page not found');
            return;
        }
        this.wrapper.querySelectorAll('[data-page_id]').forEach((p) => {
            if (!p.classList.contains('hidden')) {
                p.classList.add('hidden');
                if (this.offloads.has(p.dataset.page_id)) {
                    this.offloads.get(p.dataset.page_id)();
                }
            }
        });

        page.classList.remove('hidden');
        if (this.onloads.has(id)) {
            this.onloads.get(id)();
        }
    }
    load_ui(config) {
        config.forEach((page_config) => {
            let page_element = document.createElement('div');
            //page classes: "absolute w-full h-full flex justify-center items-center"
            page_element.classList.add(
                'hidden',
                'absolute',
                'w-full',
                'h-full',
                'flex',
                'justify-center',
                'items-center'
            );
            page_element.dataset.page_id = page_config.id;
            let page_content_element = document.createElement('div');
            page_content_element.classList.add(
                'bg-zinc-800',
                'p-8',
                'rounded-lg',
                'flex',
                'flex-col',
                '[&_*]:m-2'
            );

            page_config.elements.forEach((element) => {
                //load template
                let template = this.templates.find(
                    (t) => t.type === element.type
                );
                if (!template) {
                    console.error('Template not found');
                    return;
                }
                const serializer = new XMLSerializer();
                let document_fragment_string = serializer.serializeToString(
                    template.content
                );
                document_fragment_string = document_fragment_string.replaceAll(
                    /\{\{(\w+)\}\}/g,
                    (match, p1) => element[p1] || element.data[p1]
                );
                let element_element = new DOMParser().parseFromString(
                    document_fragment_string,
                    'text/html'
                ).firstChild.lastChild.firstChild;

                if (element.onclick !== undefined) {
                    switch (element.onclick.action) {
                        case 'changePage':
                            element_element.addEventListener('click', () => {
                                this.change_page(element.onclick.page);
                            });
                            break;
                        default:
                            break;
                    }
                }

                //append element to page
                page_content_element.appendChild(element_element);
            });
            page_element.appendChild(page_content_element);

            this.wrapper.appendChild(page_element);
        });
        //show first page
        uih_scripts_init();
        let first_page = this.wrapper.querySelector('[data-page_id="1"]');
        first_page.classList.remove('hidden');
    }
}
